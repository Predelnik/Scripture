#!/usr/bin/env python3
from clang.cindex import *
import clang.cindex
import argparse
import os
import fnmatch
import re
import json

import sys
print(sys.version)

parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-v', '--verbose', action="store_true", dest="verbose", help="Verbose output", default=False)
parser.add_argument('--args',  dest='args', action="store", help='Arguments for clang')
parser.add_argument('target_path', action="store", help='Target path')
options = parser.parse_args()

def verbose_print(str):
	if options.verbose:
		print(str)

# strips forward slashes and spaces
def strip_line(line):
	i = 0
	while i < len (line) and line[i] == '/':
		i += 1
	return line[i:].strip()

data = {
'functions' : {},
'files' : {},
'vars' : {},
'structs' : {},
}

def extract_function_args(node, info): # TODO: support comments for each argument
	info['args'] = []
	for child in node.get_children():
		if child.kind == CursorKind.PARM_DECL:
			arg_info = {}
			arg_info['name'] = child.displayname
			arg_info['type'] = child.type.spelling
			info['args'].append (arg_info)

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

def extract_function(node):
	verbose_print ('Parsing function: {}'.format (node.spelling))
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
	extract_function_args(node, info)
	 # TODO: support comments for return value
	info['returns'] = {'type' : node.result_type.spelling}
	data['functions'][node.spelling] = info

def extract_struct_members(node, info): # TODO: support comments for each argument
	info['members'] = []
	for child in node.get_children():
		member_info = {}
		member_info['name'] = child.spelling
		member_info['type'] = child.type.spelling
		member_info['comment'] = child.raw_comment
		info['members'].append (member_info)

def extract_struct(node, name):
	verbose_print ('Parsing struct: {}'.format (name))
	info = {}
	info['explanation'] = node.raw_comment # TODO: extract PCX def
	extract_struct_members(node, info)
	data['structs'][name] = info

def extract(node, filepath, short_filename):
	if str (node.location.file) == filepath: # not parsing cursors from other headers
		if node.kind == CursorKind.FUNCTION_DECL:
			extract_function(node)
			if not short_filename in data['files']:
				data['files'][short_filename] = {}
			if not 'functions' in data['files'][short_filename]:
				data['files'][short_filename]['functions'] = []
			data['files'][short_filename]['functions'].append (node.spelling)
			return
		elif node.kind == CursorKind.STRUCT_DECL:
			if node.spelling:
				extract_struct(node, node.spelling)
			return
		elif node.kind == CursorKind.TYPEDEF_DECL:
			children = node.get_children()
			try:
				first_child = next(children)
			except StopIteration:
				return
			# resolving instantly typedef structs just as normal structs
			if first_child.kind == CursorKind.STRUCT_DECL:
				extract_struct(first_child, node.spelling)
				return
	for child in node.get_children():
		extract(child, filepath, short_filename)

index = clang.cindex.Index.create()
for root, dirnames, filenames in os.walk(options.target_path):
	for filename in filenames:
		if not filename.endswith (('.cpp', '.h')):
			continue
		full_path = os.path.join (root, filename)
		verbose_print('Parsing {}...'.format(os.path.relpath (full_path, options.target_path)))
		tu = index.parse(full_path, options.args.split (' ') if options.args else None, options = TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD )
		extract (tu.cursor, full_path, filename)
json.dump (data, open ('data.json', 'w'))
