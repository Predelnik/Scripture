# data is dict specified by extract.py (unstable)
def write_idc (data, target_filename):
	fp = open (target_filename, 'w')
	fp.write ('static main() {\n')
	for name, func_data in data['functions'].items():
		if not 'address' in func_data:
			continue
		fp.write ('set_name({}, "{}");\n'.format (func_data['address'], name))
	fp.write('}\n')
