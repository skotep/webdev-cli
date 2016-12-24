var mongoose = require('mongoose')

var _questions = require('./views/questions.json')

mongoose.model('frontSurvey', new mongoose.Schema(_questions.frontquestions.reduce(function(o, e) {
	o[e.id] = String
	return o
}, {
	netid: String,
	reviewer: String,
	webapp: String,
	surveyTitle: String,
	timestamp: { type: Date, default: Date.now }
})))

mongoose.model('backSurvey', new mongoose.Schema(_questions.backquestions.reduce(function(o, e) {
	o[e.id] = String
	return o
}, {
	netid: String,
	reviewer: String,
	webapp: String,
	surveyTitle: String,
	timestamp: { type: Date, default: Date.now }
 })))

mongoose.model('frontSurveyGrade', new mongoose.Schema(_questions.frontquestions.reduce(function(o, e) {
	o[e.id] = String
	return o
}, {
	netid: String,
	reviewer: String
})))

mongoose.model('backSurveyGrade', new mongoose.Schema(_questions.backquestions.reduce(function(o, e) {
	o[e.id] = String
	return o
}, {
	netid: String,
	reviewer: String	
})))
