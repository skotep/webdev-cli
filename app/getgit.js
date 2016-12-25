#!/usr/bin/env node
if (!process.env.NODE_ENV) process.env.NODE_ENV="production"
'use strict'
const Git = process.env.CYGWIN ? null : require('nodegit')
const mongoose = require('mongoose')
const exec = require('child_process').exec
const Assignment = require('./git').Assignment
const AssignmentGrades = require('./git').AssignmentGrades
const loadAssignments = require('./assignments').loadAssignments
const getTerm = require('./assignments').getTerm
const fs = require('fs-promise')
const readline = require('readline')

const gradeFile = 'grades.csv'

function promiseExec(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, out) => {
            return err ? reject(err) : resolve(out)
        })
    })
}

function processGradeFile({gradefile, directory, files}) {
    return new Promise((resolve, reject) => {
        fs.readFile(gradefile, 'utf8')
            .then(lines => lines.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .filter(line => line[0] != '#')
                    .reduce((o, line) => {
                        const [netid, grade] = line.split(',')
                        o[netid] = grade
                        return o
                    }, {}))
            .then(gradeMap => resolve({ directory, 
                files: files.filter(file => file !== gradeFile), 
                gradeMap }))
            .catch(err => reject(err))
    })
}

function processFiles({ directory, files, gradeMap }) {
    const fileNetids = files.map(filename => filename.split('.')[0])
    const gradeOnly = Object.keys(gradeMap)
        .filter(netid => fileNetids.indexOf(netid) < 0)
        .map(netid => {
            return new Promise((res, rej) => res({ netid, grade: gradeMap[netid] }))
        })
    console.log(gradeOnly)
    return Promise.all([ ...gradeOnly, ...files.map(filename => {
        const netid = filename.split('.')[0]
        const grade = gradeMap[netid]
        if (!grade) {
            throw Error(`No grade for ${netid} but there exists a file ${filename}`)
        }
        return new Promise((res, rej) => {
            console.log('loading ', filename)
            fs.readFile(`${directory}/${filename}`)
                .then(bytestream => res({
                    netid, grade, filename, bytestream 
                }))
                .catch(err => {
                    console.error(`Error while loading ${directory}/${filename}`, err)
                    rej(err)                
               })
        })
    })])
}

function checkThenUpload(assignment, directory) {
    return new Promise((res, rej) => {

        const upload = () => {
            uploadGrades(assignment, directory).then(res).catch(rej)
        }

        const term = getTerm()
        AssignmentGrades.find({term, assignment}).exec((err, rows) => {
            if (rows.length == 0) {
                upload()
            } else {
                const rl = readline.createInterface({
                    output: process.stdout, input: process.stdin, terminal: false
                })
                process.stdout.write(`Assignment grades exist for ${term} ${assignment}.  Delete? [y/N] `)
                rl.on('line', line => {
                    if (line === 'Y' || line === 'y') {
                        rows[0].remove(err => {
                            if (err) rej(err)
                            else upload()
                        })
                    } else {
                        rej('Did not upload')
                    }
                })
            }
        })
    })
}

function uploadGrades(assignment, directory) {
    return new Promise((res, rej) => (fs.lstatSync(directory).isDirectory() ? fs.readdir(directory)
        .then(files => {
            if (files.indexOf(gradeFile) < 0) {
                throw Error(`Directory ${directory} does not contain a ${gradeFile} file with contents: netid,grade`)
            }
            return { gradefile: `${directory}/${gradeFile}`, directory, files }
        }) : new Promise((rrr, jjj) => rrr({ gradefile: directory, directory: null, files: [] }))
        )
        .then(processGradeFile)
        .then(processFiles)
        .then(gradeMap => {
            const grades = Object.keys(gradeMap).map(netid => gradeMap[netid])
            const doc = new AssignmentGrades({assignment, term: getTerm(), grades})
            console.log('Saving ', doc)
            doc.save(err => {
                if (err) {
                    throw Error(`There was an error saving ${doc} ${err}`)
                }
                console.log('saved!')
                res()
            })
        })
    )
}

function listGrades(assignment, netid) {
    const term = getTerm()
    return new Promise((res, rej) => {
        AssignmentGrades.find({term, assignment}).exec((err, raw) => {
            if (err) rej(err)
            if (raw.length != 1) rej(`No records found for ${term} ${assignment}`)
            if (netid) {
                const grades = raw[0].grades.filter(r => r.netid === netid);
                const g = grades.length > 0 ? grades[0] : { bytestream: 'no details' }
                fs.writeFileSync(g.filename, g.bytestream);
                console.log(`netid=${g.netid} grade=${g.grade} wrote=${g.filename || ''}`)
            } else {
                console.log(`# ${raw[0].term} ${raw[0].assignment} ${raw[0].timestamp}`)
                console.log('netid,grade,filename')
                raw[0].grades.forEach(g =>
                    console.log(`${g.netid},${g.grade},${g.filename || ''}`)
                )
            }
            res()
        })
    })
}

function listAssignmentsNew() {
    const term = getTerm()
    return new Promise((res, rej) => {
        Assignment.find({ term }).exec((err, raw) => {
            if (err) rej(err)
            new Set(raw.map(row => row.assignmentId)).forEach(a => console.log(a))
            res()
        })
    })
}

function listAssignments(assignments) {
    const map = assignments.reduce((o, a) => { o[a.key] = a; return o }, {})
    const term = getTerm()
    return new Promise((res, rej) => {
        Assignment.aggregate([ { $match: { term }}, 
                { $group: { _id: "$assignmentId" }} ], (err, raw) => {
            if (err) rej(err)
            try {
                raw.map(e => map[e._id])
                    .sort((a, b) => a.day - b.day)
                    .forEach(a =>
                        console.log(`${a.key},${a.dueDate},${a.name},${a.dueTime}`))
                const ids = raw.map(e => e._id)
                console.log('\nNo submissions:')
                Object.keys(map).filter(key => ids.indexOf(key) < 0).forEach(key => {
                    const a = map[key];
                    console.log(`${a.key},${a.dueDate},${a.name},${a.dueTime}`)
                })
                res()
            } catch (e) {
                rej(e)
            }
        })
    })
}

function main(assignments, {list, directory, assignment, 
        netid, force, exclude, keep, grade, duetimeOverride, sha}) {
    if (assignment === '?') {
        return listAssignments(assignments)
    }
    const infos = assignments.filter(a => a.key === assignment)
    if (!infos || !infos[0]) {
        console.log(assignments.map(a => a.key))
        throw Error(`No assignment information for ${assignment}`)
    }

    const dueHours = (duetimeOverride && duetimeOverride / 100) || 26
    const dueMinutes = (duetimeOverride && duetimeOverride - 100*parseInt(duetimeOverride/100)) || 5
    const duetimeObj = assignments.filter(a => a.key === assignment)[0].dueTime.add(dueHours, 'hours').minute(dueMinutes)
    if (duetimeOverride) console.log('Using duetime of', duetimeObj.format())
    const duetime = duetimeObj.valueOf()

    const term = getTerm()
    const query = { assignmentId: assignment, term }
    if (netid) query.netid = netid
    if (sha) { query.sha = sha; force = true }

    if (grade) {
        return list ? listGrades(assignment, netid) : checkThenUpload(assignment, directory)
    }

    return new Promise((res, rej) => {
        Assignment.find(query).exec((err, raw) => {

            // grab latest sha for each netid
            const submissions = raw.reduce((o, v) => {
                const old = o[v.netid]
                const newtime = new Date(v.submissionTimestamp).getTime()
                const oldtime = old ? new Date(old.submissionTimestamp).getTime() : null
                if (!force && newtime > duetime) {
                    v.sha = `past_due_date-${v.sha}`
                }
                if (force || newtime < duetime) {
                    o[v.netid] = (oldtime || oldtime < newtime) ? v : old
                }
                if (!o[v.netid]) {
                    o[v.netid] = v
                }
                return o
            }, {})

            if (list) {
                console.log('netid,submission,sha,commitDate,repo,author')
                if (netid) {
                    raw.filter((s) => s.netid === netid).sort((a,b) =>
                        new Date(a.submissionTimestamp).getTime() - new Date(b.submissionTimestamp).getTime()
                    ).forEach((s) => {
                        console.log(`${s.netid},${s.submissionTimestamp},${s.sha},${s.commitDate},${s.repo},${s.author}`)
                    })
                } else {
                    Object.keys(submissions).sort().forEach((netid) => {
                        const s = submissions[netid]
                        console.log(`${s.netid},${s.submissionTimestamp},${s.sha},${s.commitDate},${s.repo},${s.author}`)
                    })
                }
                res()
            } else {
                const getOne = (netid_) => {
                    const s = submissions[netid_]
                    const local = `${directory}/${s.netid}`
                    console.log(`Checking out ${s.repo} # ${s.sha} to ${local}`)
                    return promiseExec(`rm -rf ${local}`)
                        .then(() => Git.Clone(s.repo, local))
                        .then(repo => promiseExec(`cd ${local} && git checkout ${s.sha}`))
                        .then(_ => promiseExec(`cd ${local} && ls package.json | wc -l`)
                                  .then(wc => { if (wc == 1) keep = true }))
                        .then(_ => keep ? null : promiseExec(`cd ${local} && ls | grep -v ${assignment} | xargs rm -rf && rm -rf .git*`))
                        .then(_ => ({ netid: s.repo, error: false }))
                        .catch((err) => {
                            //TODO colorize
                            console.log(`Error when checking out ${s.repo} ${err}`)
                            return { netid: s.repo, error: true }
                        })
                }
                const getAll = (todo) => {
                    if (todo && todo.length) {
                        const next = todo[0]
                        return getOne(next)
                            .then(_ => getAll(todo.slice(1)))
                            .catch(err => console.error(err))
                            //TODO do better error handling
                    } else {
                        console.log('complete')
                    }
                }
                const exclusions = exclude ? (typeof exclude == 'string' ? [exclude] : exclude) : []
                getAll(Object.keys(submissions)
                        .filter(e => exclusions.indexOf(e) < 0 && submissions[e].sha.indexOf('past_due_date') < 0 ))
                        .then(res)
            }
        })
    })
}

const args = require('yargs')
.alias('a', 'assignment').nargs('a', 1).describe('a', 'assignmentId to pull from repos, e.g., inclass-1 or hw4')
.alias('d', 'directory').nargs('d', 1).describe('d', 'local directory for checking out git repos or for uploading grades')
.alias('l', 'list').describe('l',  'list submissions')
.alias('n', 'netid').nargs('n', 1).describe('n', 'netId [optional]')
.alias('x', 'exclude').nargs('x', 1).describe('x', 'exclude netids')
.alias('f', 'force').describe('f', 'load latest commit regardless of due date')
.alias('k', 'keep').describe('k', 'keep all files in checkout, do not prune')
.alias('s', 'sha').nargs('s', 1).describe('s', 'sha to checkout')
.alias('g', 'grade').describe('g', `list or upload directory of grade files, one file per student by netid, including a file ${gradeFile}`)
.alias('t', 'duetimeOverride').describe('t', 'four digit override of the due time [default is 2605 = 2AM]')
.alias('h', 'help')
.help('h')
.demand(['a'])
.epilog('Pull submission information from repos to local path and update each to respective commits.')
.argv

if (args.assignment != '?' && !args.list && !args.directory) {
    console.error('Must select either -l, --list or -d, --directory')
    process.exit(1)
}

require('./db')
mongoose.connection.on('connected', () => {
    loadAssignments()
        .then(assignments => main(assignments, args))
        .then(_ => process.exit(0))
        .catch(err => {
            console.error(err)
            process.exit(1)
        })
})
