require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/api', reportsRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/report/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'report.html'));
});

app.listen(PORT, () => {
  console.log(`Argus server listening on http://localhost:${PORT}`);
});
