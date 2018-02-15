Scripture
===========
Documentation generation system for https://github.com/sanctuary/notes inspired and partially based on https://github.com/libgit2/docurium

## Prerequisites
```
pip install -r requirements.txt
```

## Usage 

#### Regeneration
```
extract.py --args="-I$notes_dir" "$notes_dir" --github-root="https://github.com/sanctuary/notes/blob/"
```
Then copy the contents of the `site` directory to repo which is on `gh-pages` branch and push
