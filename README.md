# Rice COMP431/531 GetGit Assignment Webapp CLI

Command line interface for pulling assignment submissions
and pushing grades.

## Installation

```
npm install
```

## Pull assignments

Assignments are inclass-# or hw#.  To see what
assignments have been submitted:

```
bin/getgit -a ?
```

to list submissions for an assignment:
```
bin/getgit -a inclass-2 -l
```

to download submissions to a local directory
```
bin/getgit -a hw1 -d /local/path/to/download/to
```

## Upload Grades

Each student should have a grade file, which is either a txt file or a pdf file.
The filename should be <netid>.txt or <netid>.pdf, e.g., sep1.pdf or sep1.txt

Put all of the files in a directory.

Include a file grades.csv that has two columns: netid,grade separated by a comma, with one student per line, e.g.,
```
#netid,grade
sep1,58
raj8,74
```
suppose the grades.csv and netid.txt files are in the directory hw1-grades.  To upload the grades
```
bin/getgit -a hw1 -g -d hw1-grades
```

to verify the uploaded grades
```
bin/getgit -a hw1 -g -l 
```

## Student by Student

There is a "-n <netid>" flag that can be used to 
list the submissions of an individual student for an assignment,
rather than just the latest submission.
Additionally the "-k" flag can be used to prevent pruning
of not-current-assignment files from the git repo clone.

## Questions or Problems

Send me a message.

