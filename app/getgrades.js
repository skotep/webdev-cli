#!/usr/bin/env node
'use strict'
if (!process.env.NODE_ENV) process.env.NODE_ENV="production"
const mongoose = require('mongoose')
const fs = require('fs')
const db = require('./db')
const AssignmentGrades = require('./git').AssignmentGrades
const getTerm = require('./assignments').getTerm
const loadAssignments = require('./assignments').loadAssignments

const assignmentComparator = (a,b) => {
    const aa = a.assignment;
    const bb = b.assignment;
    if (aa.indexOf('hw') >= 0 && bb.indexOf('hw') < 0) {
        return 1;
    } else if (aa.indexOf('hw') < 0 && bb.indexOf('hw') >= 0) {
        return -1;
    }
    const fix = name => name.replace('inclass-', '')
                            .replace('hw', '')
                            .replace('-draftreview', 80)
                            .replace('-frontreview', 81)
                            .replace('-paper', 82)
                            .replace('-presentation', 83)
    const aaa = parseInt(fix(aa))
    const bbb = parseInt(fix(bb))
    return aaa - bbb
}

const weightDefinitions = {
    gr: { inclass: 0.01, hw: 0.06, final: 0.12, survey: 0.05, paper: 0.06*2 },
    ug: { inclass: 0.01, hw: 0.09, final: 0.13, survey: 0, paper: 0 },
    counts: { inclass: 24, hw: 7, final: 1, survey: 2, paper: 2, finalName: 'hw8' }
}

const weightedGrades = (ug, grades) => {
    const weights = weightDefinitions[ug ? 'ug' : 'gr']

    const inclass = grades
        .filter(({assignment}) => assignment.indexOf('inclass') == 0)
        .map(({grade}) => grade)
    inclass.sort()
    inclass.reverse()
    const inclassGrade = inclass.slice(0, 
            weightDefinitions.counts.inclass).reduce((a,b) => a+b)

    const weighted = grades.filter(({assignment}) => assignment.indexOf('inclass') < 0)
    .reduce((o, {assignment, grade}) => {
        const w = assignment.indexOf('review') > 0 ? weights.survey :
            assignment.indexOf('p') > 0 ? weights.paper :
            assignment.indexOf(weightDefinitions.counts.finalName) >= 0 ? weights.final :
            weights.hw
        const name = assignment.indexOf('-') > 0 ?  assignment : 
            assignment == weightDefinitions.counts.finalName ? 'final' : 'hw'
        o[name] = (o[name] || 0) + w * grade
        return o
    }, { inclass: inclassGrade })

    weighted.total = Object.keys(weighted).map(k => weighted[k]).reduce((a,b) => a + b)
    const weightedGrades = Object.keys(weighted)
        .map(k => ({assignment:k, grade: weighted[k]}))
        .reduce((o,v) => { //if (weights[v.assignment] || v.assignment == 'total') 
            o.push(v); return o }, [])

    return weightedGrades
}

const getOne = (netid, rows) => {
    const grades = rows.map(({assignment, grades}) => {
        const f = grades.filter(g => g.netid == netid)
        const grade = (f && f[0]) ? f[0].grade : 0
        return { assignment, grade }
    })
    return grades
}

const displayGrades = (ug, netid, grades) => {
    const weights = weightDefinitions[ug ? 'ug' : 'gr']
    const counts = weightDefinitions.counts
    grades.sort(assignmentComparator)
    console.log('')
    console.log(`netid: ${netid}`)
    console.log('')
    console.log('assignment\tgrade')
    console.log('==========\t=====')
    const p = a => {
        let name = a.assignment;
        while(name.length < 8) {
            name = `${name} `
        }
        const key = a.assignment.indexOf('review') >= 0 ? 'survey' : 
                    a.assignment.indexOf('hw-p') == 0 ? 'paper' :
                    a.assignment
        const weight = weights[key] * 
            (['inclass','hw'].indexOf(key) >= 0 ? counts[key] : 
                key.indexOf('paper') == 0 ? 0.5 : 1) * 100.0
        console.log(`${name}\t${a.grade.toFixed(1)}${weight ? '/'+weight : ''}`)
    }
    grades.forEach(p)
    console.log('')
    console.log('Summary')
    console.log('=======')
    const wg = weightedGrades(ug, grades)
    wg.forEach(p)
    console.log('')
    return [{ netid: args.netid, 
              grade: wg.filter(r => r.assignment == 'total')[0].grade }]
}

const main = args => new Promise((resolve, reject) => {
    const term = getTerm()
    if (args.check) {
        return checkWeights(term).then(resolve).catch(reject)
    }
    const roster = fs.readFileSync(args.roster, 'utf-8').split('\n').reduce((o,v) => {
        const s = v.split(',');
        if (s.length > 2) {
            const netid = s[0]
            const grug = s[2].indexOf('531') > 0 ? 'gr' : 'ug'
            o[netid] = grug
        }
        return o
    }, {})
    AssignmentGrades.find({term}).exec((err, rows) => {
        if (err) return reject(new Error(err))
        try {
            resolve(args.netid ?
                displayGrades(roster[args.netid] == 'ug', args.netid, getOne(args.netid, rows)) :
                Object.keys(roster).map(netid => {
                    const ug = roster[netid]
                    return { netid, ug,
                        grade: weightedGrades(ug == 'ug', getOne(netid, rows))
                            .filter(r => r.assignment == 'total')[0].grade }
                }))
        } catch (err) {
            reject(err)
        }
    })
})

const checkWeights = (term) => new Promise((resolve, reject) => {
    AssignmentGrades.find({term}).exec((err,rows) => {
        const grades = rows.map(({assignment, grades}) => {
            const grade = assignment.indexOf('hw-p') >= 0 ? 50 :
                assignment.indexOf('hw') >= 0 ? 100 : 1
            return { assignment, grade }
        })
        grades.push({ assignment: 'hw7', grade: 100 })
        grades.push({ assignment: 'hw8', grade: 100 })
        try {
            console.log('ug', displayGrades(true, 'ug', grades))
            console.log('gr', displayGrades(false, 'gr', grades))
            resolve()
        } catch (err) {
            console.error(err)
                reject(err)
        }
    })
})

const args = require('yargs')
    .alias('r', 'roster').nargs('r', 1).describe('r', 'student roster')
    .alias('n', 'netid').nargs('n', 1).describe('n', 'netId [optional]')
    .alias('c', 'check').describe('c', 'check grade weights')
    .demand(['r'])
    .argv

mongoose.connection.on('connected', () => {
    loadAssignments()
        .then(_ => main(args))
        .then(grades => grades ? grades.forEach(({netid, grade, ug}) => 
                    console.log(`${netid},${grade.toFixed(1)},${ug}`)) : '')
        .then(_ => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1)
        })
});
            
