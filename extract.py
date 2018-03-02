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
from lib.idc_backend import *

import sys

def dict_gen():
	return defaultdict(dict)

# strips forward slashes and spaces
def strip_comment_line(line):
	i = 0
	while i < len (line) and line[i] != '/':
		i += 1
	while i < len (line) and line[i] == '/':
		i += 1
	if i < len (line) and line[i] == ' ':
		i += 1
	if i < len (line) and line[i] == '<':
		i += 1
	return line[i:]

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

def type_spelling (type):
	# it's unclear if this extraction could be done through clang.cindex:
	spelling = type.spelling
	for part in ['enum ', 'struct ']:
		if spelling.startswith (part):
			spelling = spelling[len (part):]
	return spelling

def add_reference_if_needed (data, source_type, source_name, type):
	#print ('Try:')
	#print (type.kind)
	#print (type.spelling)
	simplified_type = type
	while simplified_type.kind == TypeKind.CONSTANTARRAY:
		simplified_type = simplified_type.get_array_element_type ()
	while simplified_type.kind == TypeKind.POINTER:
		simplified_type = simplified_type.get_pointee ()
	if simplified_type.kind == TypeKind.ELABORATED:
		simplified_type = simplified_type.get_named_type ()
	if simplified_type.kind == TypeKind.TYPEDEF:
		simplified_type = simplified_type.get_canonical ()
	dest = None
	if simplified_type.kind == TypeKind.RECORD:
		dest = 'structs'
	elif simplified_type.kind == TypeKind.ENUM:
		dest = 'enums'
	if dest:
		spelling = type_spelling (simplified_type)
		#print (simplified_type.kind)
		#print (spelling)
		append_to_set_in_dict (data, [dest, spelling, 'referenced_in', source_type], source_name)

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
	lines = [strip_comment_line(line) for line in lines]
	return lines

def extract_by_pattern(line, dict, target, pattern):
	m = re.match(pattern, line)
	if m:
		dict[target] = m.group(1)
		return True
	return False

def extract_function(data, node):
	comment = node.raw_comment
	info = {}
	if comment:
		explanation = []
		for line in comment_to_lines (comment):
			if extract_by_pattern(line, info, 'address', 'address:? (.*)'):
				data['addresses'][info['address']] = {'type': 'function', 'name': node.spelling}
				continue
			if extract_by_pattern(line, info, 'psx_ref', 'PSX ref:? (.*)'):
				continue
			if extract_by_pattern(line, info, 'ordinal', 'ordinal:? (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_def', 'PSX def:? (.*)'):
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

def fill_enum_struct_comment_data (comment, info):
	if not comment:
		return ''
	explanation = []
	target = 'explanation'
	data = {}
	for line in comment_to_lines (comment):
		if line == 'References:':
			break
		elif line == 'bitflag':
			info['bitflag'] = True
			break
		elif line == 'PSX def:':
			target = 'psx_def'
			continue
		elif line.startswith ('}'):
			target == 'explanation'
		else:
			m = re.match ('size = 0x([0-9A-F]+)', line)
			if m:
				info['size'] = int (m.group(1), 16)
				continue
		if line:
			if not target in data:
				data[target] = []
			data[target].append (line)
	for key, lines in data.items():
		info[key] = '\n'.join (lines)

def extract_struct_member_comment(comment, info):
	if not comment:
		return
	explanation = []
	for line in comment_to_lines(comment):
		m = re.match ('offset:? ([A-F0-9]+) \(([0-9]+) bytes?\)', line)
		if m:
			info['offset'] = m.group(1)
			info['size'] = m.group(2)
			continue
		explanation.append (line)
	info['explanation'] = '\n'.join (explanation)

def extract_struct_members(data, node, info, name): # TODO: support comments for each argument
	info['members'] = []
	for child in node.get_children():
		member_info = {}
		member_info['name'] = child.spelling
		member_info['type'] = type_spelling (child.type)
		extract_struct_member_comment (child.raw_comment, member_info)
		info['members'].append (member_info)
		add_reference_if_needed (data, 'structs', name, child.type)

def extract_struct(data, node, name):
	info = {}
	fill_enum_struct_comment_data (node.raw_comment, info)
	info['extracted'] = True
	extract_struct_members(data, node, info, name)
	data['structs'][name] = info
	return data['structs'][name]

def extract_enum_members(node, info): # TODO: support comments for each argument
	info['members'] = []
	for child in node.get_children():
		member_info = {}
		member_info['name'] = child.spelling
		member_info['value'] = child.enum_value
		if child.raw_comment:
			member_info['explanation'] = '\n'.join (comment_to_lines (child.raw_comment))
		info['members'].append (member_info)

def extract_enum(data, node, name):
	info = {}
	fill_enum_struct_comment_data (node.raw_comment, info)
	extract_enum_members(node, info)
	data['enums'][name] = info
	return data['enums'][name]

def extract_var (data, node):
	comment = node.raw_comment
	info = {}
	if comment:
		explanation = []
		for line in comment_to_lines (comment):
			if extract_by_pattern(line, info, 'address', 'address:? (.*)'):
				data['addresses'][info['address']] = {'type': 'variable', 'name': node.spelling}
				continue
			if extract_by_pattern(line, info, 'psx_ref', 'PSX ref:? (.*)'):
				continue
			if extract_by_pattern(line, info, 'psx_def', 'PSX def:? (.*)'):
				continue
			if line:
				explanation.append (line)
		info['explanation'] = '\n'.join (explanation)
	add_reference_if_needed (data, 'vars', node.spelling, node.type)
	info['type'] = node.type.spelling
	data['vars'][node.spelling] = info
	return data['vars'][node.spelling]

def extract(data, node, filepath, short_filename, full_filename):
	fp = open (full_filename, 'rb')
	if str (node.location.file) == filepath: # not parsing cursors from other headers
		info = None
		if node.kind == CursorKind.FUNCTION_DECL:
			func_data = extract_function(data, node)
			func_data['short_file_name'] = short_filename
			func_data['full_file_name'] = full_filename
			append_to_set_in_dict (data, ['files', short_filename, 'functions'], node.spelling)
			info = func_data
		elif node.kind == CursorKind.STRUCT_DECL:
			if node.spelling:
				info = extract_struct(data, node, node.spelling)
		elif node.kind == CursorKind.ENUM_DECL:
			info = extract_enum(data, node, node.spelling)
		elif node.kind == CursorKind.VAR_DECL:
			var_data = extract_var (data, node)
			var_data['short_file_name'] = short_filename
			var_data['full_file_name'] = full_filename
			if 'rdata' in filepath:
				var_data['category'] = 'readonly'
			elif 'data' in filepath:
				var_data['category'] = 'readwrite'
			else:
				var_data['category'] = 'uninitialized'
			# TODO: separate const/non-const etc.
			append_to_set_in_dict (data, ['files', short_filename, 'vars'], node.spelling)
			info = var_data
		elif node.kind == CursorKind.TYPEDEF_DECL:
			children = node.get_children()
			try:
				first_child = next(children)
			except StopIteration:
				return
			# resolving instantly typedef structs just as normal structs
			if first_child.kind == CursorKind.STRUCT_DECL:
				info = extract_struct(data, first_child, node.spelling)
			elif first_child.kind == CursorKind.ENUM_DECL:
				info = extract_enum(data, first_child, node.spelling)
		if info:
			info['full_file_name'] = full_filename
			info['line'] = node.extent.start.line
			fp.seek (node.extent.start.offset)
			info['text'] = fp.read (node.extent.end.offset - node.extent.start.offset + 1).decode ('utf-8')
			return
	for child in node.get_children():
		extract(data, child, filepath, short_filename, full_filename)
	return data

def extract_file (params):
	data = defaultdict (dict_gen)
	index = clang.cindex.Index.create()
	tu = index.parse(params['full_path'], params['args'], options = TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD )
	extract (data, tu.cursor, params['full_path'], params['short_filename'], params['full_filename'])
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
	parser.add_argument('--github-root', dest='github_root', action="store", help='GitHub root used for links')
	parser.add_argument('--github-sha1', dest='github_sha1', action="store", help='GitHub revision sha1. Used for permanent links')
	parser.add_argument('--idc-path', dest='idc_path', action="store", help='Also create .idc script based on sources')
	parser.add_argument('target_path', action="store", help='Target path')
	options = parser.parse_args()

	file_name_list = []
	args = options.args.split (' ') if options.args else None
	just_regenerate_idc = False # to simplify debugging IDC generation

	for root, dirnames, filenames in os.walk(options.target_path):
		for filename in filenames:
			if not filename.endswith (('.cpp', '.h')):
				continue
			full_path = os.path.join (root, filename)
			file_name_list.append ({'full_path': full_path, 'short_filename' : filename, 'full_filename' : os.path.relpath (full_path, options.target_path).replace ('\\', '/'), 'args' : args} )

	data = {}
	if not just_regenerate_idc:
		pool = multiprocessing.Pool ()
		#results = list (map(extract_file, file_name_list))
		results = list (pool.map(extract_file, file_name_list))
		for r in results:
			merge_to_dict (data, r)
		structs = data['structs']
		#removing possible alien structs referenced
		for name in list (structs.keys ()):
			if not 'extracted' in structs[name]:
				del structs[name]
		if options.github_root:
			data['github_root'] = options.github_root
		if options.github_sha1:
			data['github_sha1'] = options.github_sha1

	target_path = os.path.join (os.path.dirname(os.path.realpath(__file__)), 'site/data/data.json')
	os.makedirs (os.path.dirname (target_path), exist_ok=True)
	if not just_regenerate_idc:
		json.dump (data, open (target_path, "w"), cls=SetEncoder)
	else:
		data = json.load (open (target_path))
	print ('{} updated successfully!'.format (target_path))

	if options.idc_path:
		write_idc (data, options.idc_path, options.target_path)
