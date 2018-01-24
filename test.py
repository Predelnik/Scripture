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

functions = {}
files = {}
types = {}
vars = {}

def extract_function_args(node, info): # TODO: support comments for each argument
	info['args'] = []
	for child in node.get_children():
		if child.kind == CursorKind.PARM_DECL:
			arg_info = {}
			arg_info['name'] = child.displayname
			arg_info['type'] = child.type.spelling
			info['args'].append (arg_info)

def extract_function(node):
	verbose_print ('Parsing function:\n {}'.format (node.spelling))
	comment = node.raw_comment
	info = {}
	if comment:
		comment = comment.replace ('\r\n', '\n')
		lines = comment.split ('\n')
		lines = [strip_line(line) for line in lines]
		explanation = []
		for line in lines:
			m = re.match('address: (.*)', line)
			if m:
				info['address'] = m.groups(1)
				continue

			m = re.match('PSX ref: (.*)', line)
			if m:
				info['psx_ref'] = m.groups(1)
				continue
				
			m = re.match('PSX def: (.*)', line)
			if m:
				info['psx_def'] = m.groups(1)
				continue
			
			if line:
				explanation.append (line)
		info['explanation'] = '\n'.join (explanation)
	extract_function_args(node, info)
	functions[node.spelling] = info

def extract(node, filepath, short_filename):
	if str (node.location.file) == filepath: # not parsing cursors from other headers
		if node.kind == CursorKind.FUNCTION_DECL:
			extract_function(node)
			files[short_filename]['functions'].append (node.spelling)

	for child in node.get_children():
		extract(child, filepath, short_filename)

index = clang.cindex.Index.create()
for root, dirnames, filenames in os.walk(options.target_path):
	for filename in filenames:
		files[filename] = {}
		files[filename]['functions'] = []
		if not filename.endswith (('.cpp', '.h')):
			continue
		full_path = os.path.join (root, filename)
		verbose_print('Parsing {}...'.format(os.path.relpath (full_path, options.target_path)))
		tu = index.parse(full_path, options.args.split (' ') if options.args else None, options = TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD )
		extract (tu.cursor, full_path, filename)
json.dump (functions, open ('functions.json', 'w'))
json.dump (files, open ('files.json', 'w'))