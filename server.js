const express = require('express')
const app = express()
// Middleware to parse JSON bodies from POST requests
app.use(express.json())

const favLangs = ['html', 'css', 'javascript', 'react']

// GET endpoint
app.get('/api/get-records', (req, res) => {
	res.json({ lan: favLangs })
})

// POST endpoint
app.post('/api/get-records', (req, res) => {
	const record = req.body.record
	// Add some response to confirm receipt
	res.json({ status: 'ok', received: record })
})

// Start the server
app.listen(1337, () => {
	console.log('server started on 1337')
})
