# Rice COMP431/531 GetGit Assignment Webapp CLI

Command line interface for pulling assignment submissions
and pushing grades.

## Installation

```
npm install
```

Note that if installation fails at the preinstall stage of `nodegit`
the problem is most likely missing SSL headers.
On Ubuntu, do `apt install libssl-dev` to install these headers.
(See: https://github.com/nodegit/nodegit/issues/1037)

# Usage

Familiarize yourself with the command line flags
```
bin/getgit -?
```
In general you either list the submissions (-l) or download to a directory (-d).

See below for uploading of assignment grades.

## List and Pull assignments

Assignments are inclass-# or hw#.  To see what
assignments have been submitted:

```
bin/getgit -a ?
```

to list latest submissions for an assignment:
```
bin/getgit -a inclass-2 -l
```

to download latest submissions to a local directory
```
bin/getgit -a hw1 -d /local/path/to/download/to
```
note that this does not pull past-due submissions.  It should pull the latest non-past-due submission for each student.  

## Downloading Submissions

Downloading submissions first checks out the repo, then updates the repo t
the latest non-past-due commit sha, and finally prunes the checkout of all non-current
assignment folders.  I.e., when checking out for hw3 only the hw3 directory
will remain after the program finishes. 
The "-k" flag can be used to prevent pruning
of not-current-assignment files from the git repo clone, i.e., to 
download the entire repo 

## Student by Student

There is a "-n <netid>" flag that can be used to 
list the submissions of an individual student for an assignment,
rather than just the latest submission.

Use "-s <sha>" to specify downloading a specific commit sha.


## Due time

The "-a ?" list shows the due date and due time of each assignment.  To adjust the due time use "-t<2605>" flag, where 2605 = 2:05AM, i.e., to allow all assignments submitted at 2:15AM as *not* being late use "-t 2615"

To use the latest commit regardless of due date or time use the "-f" flag.

## Other functionality 

* You can selectively exclude certain netids from being downloaded with -x


# Upload Grades

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

## Questions or Problems

Send me a message.

