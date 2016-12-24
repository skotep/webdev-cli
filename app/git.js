const mongoose = require('mongoose')
const exec = require('child_process').exec
const Git = process.env.CYGWIN ? null : require('nodegit')

const tmp = '/tmp/git-repo'

const Assignment = mongoose.model('assignment', new mongoose.Schema(
{
    netid: String,
    term: String,
    assignmentId: String,
    submissionTimestamp: { type: Date, default: Date.now },
    repo: String,
    sha: String,
    author: String,
    commitDate: String,
    message: String,
    contents: [String]
}))

const assignmentGradesSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    term: String,
    assignment: String,
    grades: [{
        netid: String,
        grade: Number,
        filename: String,
        bytestream: Buffer
    }]
})
assignmentGradesSchema.index({ term: 1, assignment: 1 }, { unique: true });
const AssignmentGrades = mongoose.model('assignmentGrades', assignmentGradesSchema)


exports.Assignment = Assignment
exports.AssignmentGrades = AssignmentGrades

exports.getGitCommit = (term, netid, assignmentId, repoURL) => {
    return new Promise((resolve, reject) => {
        let recentCommit, contents = []
        Git.Clone(repoURL, tmp)
        .then((repo) =>
            repo.getMasterCommit()
        ).then((commit) => {            
            recentCommit = commit
            return commit.getEntry(assignmentId)
        }).then((entry) => {
            if (!entry.isDirectory())
                throw new Error(`${assignmentId} is not a directory in ${repoURL}`)
            return entry.getTree()
        }).then((tree) => {
            const walker = tree.walk(true)
            walker.on('end', (trees) => {
                contents = trees.map((e) => e.path())
                resolve(new Assignment({
                    term: term,
                    netid: netid,
                    assignmentId: assignmentId,
                    submissionTimestamp: new Date(),
                    repo: repoURL,
                    sha: recentCommit.sha(),
                    author: recentCommit.author(),
                    commitDate: recentCommit.date(),
                    message: recentCommit.message(),
                    contents: contents
                }))
            })
            walker.start()
        }).catch((err) => {
            const msg = `There was an error when looking for ${assignmentId} at ${repoURL}. ${err}`
            console.error(msg)
            reject(new Error(msg))
        }).finally(() => {
            exec(`rm -rf ${tmp}`, (err,out) => {
                //
            })
        }).done()
    })
}
