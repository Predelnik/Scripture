# data is dict specified by extract.py (unstable)
def write_header (fp):
	fp.write ('#include <idc.idc>\n')
	fp.write ('static main() {\n')
	for bits in ['8', '16', '32']:
		for prefix in [('u', 'unsigned '), ('', '')]:
			for body in ['int', 'bool']:
				if body == 'bool' and prefix[0] == 'u':
					continue
				source_type = '{}{}{}_t'.format (prefix[0], body, bits)
				dest_type = '{} __int{}'.format (prefix[1], bits)
				fp.write ('if (find_custom_data_type("{}") == -1)\n'.format (source_type))
				fp.write ('  set_local_type (-1, "typedef {} {}", 0);\n'.format (dest_type, source_type))

def write_idc (data, target_filename):
	fp = open (target_filename, 'w')
	write_header (fp)
	for name, func_data in data['functions'].items():
		if not 'address' in func_data:
			continue
		fp.write ('set_name({}, "{}");\n'.format (func_data['address'], name))
		fp.write ('apply_type ({}, "{}", TINFO_DEFINITE);\n'.format (func_data['address'], func_data['text']))
	fp.write('}\n')
