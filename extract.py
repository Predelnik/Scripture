#!/usr/bin/env python3
from clang.cindex import *
import clang.cindex
import argparse
import os
import fnmatch
import re
import json
import multiprocessing
from collections import *
import copy

import sys

def dict_gen():
	return defaultdict(dict)

# strips forward slashes and spaces
def strip_line(line):
	i = 0
	while i < len (line) and line[i] == '/':
		i += 1
	return line[i:].strip()

def append_to_set_in_dict (dict, field_list, value):
	for field in field_list[:-1]:
		if field in dict:
			dict = dict[field]
		else:
			dict[field] = {}
			dict = dict[field]
	last_field = field_list[-1]
	if last_field in dict:
		dict[last_field].add (value)
	else:
		dict[last_field] = {value}

def add_reference_if_needed (data, source_type, source_name, type):
	simplified_type = type
	#print (simplified_type.spelling)
	#print (simplified_type.kind)
	if simplified_type.kind == TypeKind.POINTER:
		simplified_type = simplified_type.get_pointee ()
	if simplified_type.kind == TypeKind.CONSTANTARRAY:
		simplified_type = simplified_type.get_array_element_type ()
	if simplified_type.kind == TypeKind.TYPEDEF:
		simplified_type = simplified_type.get_canonical ()
	#print (simplified_type.spelling)
	#print (simplified_type.kind)
	dest = None
	if simplified_type.kind == TypeKind.RECORD:
		dest = 'structs'
	elif simplified_type.kind == TypeKind.ENUM:
		dest = 'enums'
	if dest:
		#if simplified_type.spelling == 'Item':
		#	print (source_name)
		append_to_set_in_dict (data, [dest, simplified_type.spelling, 'referenced_in', source_type], source_name)

def extract_function_args(node, info, data): # TODO: support comments for each argument
	info['args'] = []
	for child in node.get_children():
		if child.kind == CursorKind.PARM_DECL:
			arg_info = {}
			arg_info['name'] = child.displayname
			type = child.type
			arg_info['type'] = type.spelling
			info['args'].append (arg_info)
			add_reference_if_needed (data, 'functions', node.spelling, type)

def comment_to_lines(comment):
	comment = comment.replace ('\r\n', '\n')
	lines = comment.split ('\n')
	lines = [strip_line(line) for line in lines]
	return lines

def extract_by_pattern(line, dict, target, pattern):
	m = re.match(pattern, line)
	if m:
		dict[target] = m.groups(1)
		return True
	return False

def extract_function(data, node):
	comment = node.raw_comment
	info = {}
	if comment:
		explanation = []
		for line in comment_to_lines (comment):
			if extract_by_pattern(line, info, 'address', 'address: (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_ref', 'PSX ref: (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_def', 'PSX def: (.*)'):
				continue
			if line:
				explanation.append (line)
		info['explanation'] = '\n'.join (explanation)
	extract_function_args(node, info, data)
	 # TODO: support comments for return value
	add_reference_if_needed (data, 'functions', node.spelling, node.result_type)
	info['returns'] = {'type' : node.result_type.spelling}
	data['functions'][node.spelling] = info
	return data['functions'][node.spelling]

def extract_struct_members(data, node, info, name): # TODO: support comments for each argument
	info['members'] = []
	for child in node.get_children():
		member_info = {}
		member_info['name'] = child.spelling
		member_info['type'] = child.type.spelling
		member_info['comment'] = child.raw_comment
		info['members'].append (member_info)
		add_reference_if_needed (data, 'structs', name, child.type)

def extract_struct(data, node, name):
	info = {}
	info['explanation'] = node.raw_comment # TODO: extract PCX def
	info['extracted'] = True
	extract_struct_members(data, node, info, name)
	data['structs'][name] = info

def extract_enum_members(node, info): # TODO: support comments for each argument
	info['members'] = []
	for child in node.get_children():
		member_info = {}
		member_info['name'] = child.spelling
		member_info['value'] = child.enum_value
		member_info['comment'] = child.raw_comment
		info['members'].append (member_info)

def extract_enum(data, node, name):
	info = {}
	info['explanation'] = node.raw_comment # TODO: extract PCX def
	extract_enum_members(node, info)
	data['enums'][name] = info
	return data

def extract_var (data, node):
	comment = node.raw_comment
	info = {}
	if comment:
		explanation = []
		for line in comment_to_lines (comment):
			if extract_by_pattern(line, info, 'address', 'address: (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_ref', 'PSX ref: (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_def', 'PSX def: (.*)'):
				continue
			if line:
				explanation.append (line)
		info['explanation'] = '\n'.join (explanation)
	add_reference_if_needed (data, 'vars', node.spelling, node.type)
	info['type'] = node.type.spelling
	data['vars'][node.spelling] = info
	return data['vars'][node.spelling]

def extract(data, node, filepath, short_filename):
	if str (node.location.file) == filepath: # not parsing cursors from other headers
		if node.kind == CursorKind.FUNCTION_DECL:
			func_data = extract_function(data, node)
			func_data['file_name'] = short_filename
			append_to_set_in_dict (data, ['files', short_filename, 'functions'], node.spelling)
			return
		elif node.kind == CursorKind.STRUCT_DECL:
			if node.spelling:
				extract_struct(data, node, node.spelling)
			return
		elif node.kind == CursorKind.ENUM_DECL:
			extract_enum(data, node, node.spelling)
			return
		elif node.kind == CursorKind.VAR_DECL:
			var_data = extract_var (data, node)
			var_data['file_name'] = short_filename
			# TODO: separate const/non-const etc.
			append_to_set_in_dict (data, ['files', short_filename, 'vars'], node.spelling)
			return
		elif node.kind == CursorKind.TYPEDEF_DECL:
			children = node.get_children()
			try:
				first_child = next(children)
			except StopIteration:
				return
			# resolving instantly typedef structs just as normal structs
			if first_child.kind == CursorKind.STRUCT_DECL:
				extract_struct(data, first_child, node.spelling)
				return
			elif first_child.kind == CursorKind.ENUM_DECL:
				extract_enum(data, first_child, node.spelling)
				return
	for child in node.get_children():
		extract(data, child, filepath, short_filename)
	return data

def extract_file (params):
	data = defaultdict (dict_gen)
	index = clang.cindex.Index.create()
	tu = index.parse(params['full_path'], params['args'], options = TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD )
	extract (data, tu.cursor, params['full_path'], params['short_filename'])
	return data

def merge_to_dict (target, source):
	if isinstance(source, dict) or isinstance(source, defaultdict):
		if target is None:
			target = dict()
		for key, value in source.items():
			if key in target:
				merge_to_dict (target[key], value)
			else:
				target[key] = value
	elif isinstance (target, list):
		target += source
	elif isinstance (target, Set):
		target |= source
	else:
		target = source

class SetEncoder(json.JSONEncoder):
	def default(self, obj):
		if isinstance(obj, set):
			return sorted(list(obj))
		return json.JSONEncoder.default(self, obj)

if __name__ == '__main__':
	parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-v', '--verbose', action="store_true", dest="verbose", help="Verbose output", default=False)
	parser.add_argument('--args',  dest='args', action="store", help='Arguments for clang')
	parser.add_argument('target_path', action="store", help='Target path')
	options = parser.parse_args()

	file_name_list = []
	args = options.args.split (' ') if options.args else None

	for root, dirnames, filenames in os.walk(options.target_path):
		for filename in filenames:
			if not filename.endswith (('.cpp', '.h')):
				continue
			full_path = os.path.join (root, filename)
			file_name_list.append ({'full_path': full_path, 'short_filename' : filename, 'args' : args} )

	pool = multiprocessing.Pool ()
	#results = list (map(extract_file, file_name_list))
	results = list (pool.map(extract_file, file_name_list))
	data = {}
	for r in results:
		merge_to_dict (data, r)
	structs = data['structs']
	# removing possible alien structs referenced
	for name in list (structs.keys ()):
		if not 'extracted' in structs[name]:
			del structs[name]
	target_path = os.path.join (os.path.dirname(os.path.realpath(__file__)), 'site/data/data.json')
	os.makedirs (os.path.dirname (target_path), exist_ok=True)
	json.dump (data, open (target_path, "w"), cls=SetEncoder)
	