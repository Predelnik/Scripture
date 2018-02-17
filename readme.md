Scripture
===========
Documentation generation system for https://github.com/sanctuary/notes inspired and partially based on https://github.com/libgit2/docurium

## Prerequisites
```
pip install -r requirements.txt
```

## Usage 

#### Regeneration
Copy `extract.sh.sample` as `extract.sh` and fix path to notes inside it. Then run `extract.sh`

Then copy the contents of the `site` directory to repo which is checked out to `gh-pages` branch and push manually, or also add it to extraction script.
