Scripture
===========
Documentation generation system for _Notes about Diablo 1 Game Engine_ (https://github.com/sanctuary/notes) inspired and partially based on https://github.com/libgit2/docurium

Additionally it can experimentally generate `.IDC` script to populate [IDA](https://en.wikipedia.org/wiki/Interactive_Disassembler) database with data from notes.

## Prerequisites
```
pip install -r requirements.txt
```

## Usage 

#### Regeneration
Copy `extract.sh.sample` as `extract.sh` and fix path to notes inside it. Then run `extract.sh`

Then copy the contents of the `site` directory to repo which is checked out to `gh-pages` branch and push manually, or also add it to extraction script.

If you wish to generate IDC script, path to it could be specified with `--idc-path` option
