const fetch = require('node-fetch')
const moment = require('moment')

let planning
function loadAssignments() {

    function processAssignments() {
        const assignments = [
            ...planning.sessions.filter((e) => {
                return e.day
            }).map((e) => {
                return { key: `inclass-${e.day}`, day: e.day, dueTime: getDueTime(e.day, e.offset), dueDate: getDueDate(e.day, e.offset), name: e.topic, type: 'inclass' }
            }),
            ...planning.assignments.filter((e) => 
                e.name.indexOf('COMP531') < 0 || e.id === 'paper'
            ).map((e, i) => {
                const ii = e.id === 'paper' ? `-${e.id}` : i+1
                const type = e.id === 'paper' ? 'inclass' : 'hw'
                const key = e.full ? `hw${ii}-frontend` : `hw${ii}`
                return { key, day: e.due, 
                     dueTime: getDueTime(e.due, e.offset), 
                     dueDate: getDueDate(e.due, e.offset), 
                     name: e.name, type: type }
            })
        ]
        assignments.filter(e => e.key.endsWith('-frontend'))
            .map(e => Object.assign({}, e, 
                            { key: e.key.replace('-frontend', '-backend') }))
            .forEach(e => assignments.push(e))
        assignments.sort((a, b) => {
            if (a.day < b.day) return -1
            if (a.day > b.day) return +1
            if (a.type === 'inclass') return -1
            if (b.type === 'inclass') return +1
            return 0
        })
        return assignments
    }

    return new Promise((resolve, reject) => 
         fetch('https://www.clear.rice.edu/comp431/planning.json')
              .then(r => r.json())
              .then(data => {
                   planning = data
              })
              .catch(err => {
                   console.error(err.messsage)
                   console.error('loading assignments locally')
                   planning = require('./planning.json')
              }).then(_ => resolve(processAssignments()))
    )
}

function getDueDate(sessionDay, offset = 0) {
   return getDueTime(sessionDay, offset)
        .format("ddd MM/DD")
}

function getDueTime(sessionDay, offset = 0) {
    var week = Math.floor((sessionDay + offset - 1) / 2);
    var dow = (sessionDay + offset - 1) - 2 * week;
    return moment(planning.class.firstDay)
        .add(week, 'weeks').add(dow * 2, 'days')
}

exports.loadAssignments = loadAssignments
exports.getTerm = () => `${planning.class.year}${planning.class.term}`
exports.getYear = () => planning.class.year
exports.getDueDate = getDueDate
exports.getDueTime = getDueTime
