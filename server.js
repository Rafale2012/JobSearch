import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Enhanced company list with direct Greenhouse public API endpoints
const TARGET_COMPANIES = [
  // These use direct Greenhouse public APIs (more reliable)
  { name: 'Verkada', greenhouse_id: 'verkada' },
  { name: 'Sourcegraph', greenhouse_id: 'sourcegraph' },
  { name: 'Scale AI', greenhouse_id: 'scaleai' },
  { name: 'Anduril', greenhouse_id: 'andurilindustries' },
  { name: 'Shield AI', greenhouse_id: 'shieldai' },
  { name: 'Zipline', greenhouse_id: 'zipline' }
];

const KEYWORDS = [
  'aerospace','uav','drone','unmanned','air mobility','robotics','embedded',
  'firmware','autonomy','autonomous','flight test','guidance','navigation',
  'control','px4','ros','ros2','rtos','can','can bus','bvlos','environmental',
  'climate','reforestation','sustainability','hardware','mechanical','electrical'
];

const LOCATION_PREFERENCES = ['montreal','quebec','canada','remote','hybrid'];

function scoreJob(job) {
  const text = (
    (job.title || '') + ' ' +
    (job.location || '') + ' ' +
    (job.description || '')
  ).toLowerCase();

  let score = 0;

  KEYWORDS.forEach(k => { if (text.includes(k)) score += 3; });
  LOCATION_PREFERENCES.forEach(loc => { if (text.includes(loc)) score += 2; });

  if (text.includes('startup') || text.includes('fast-paced')) score += 2;
  if (text.includes('r&d') || text.includes('research') || text.includes('prototype')) score += 2;
  if (text.includes('climate') || text.includes('sustainab') || text.includes('reforest')) score += 3;

  return score;
}

// Fetch from Greenhouse public API directly
async function fetchGreenhouseJobs(greenhouseId, companyName) {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${greenhouseId}/jobs?content=true`;
    console.log(`Fetching from: ${url}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch ${companyName}:`, res.status);
      return [];
    }
    
    const data = await res.json();
    const jobs = data.jobs || [];
    
    console.log(`Found ${jobs.length} jobs at ${companyName}`);
    
    return jobs.map(j => ({
      title: j.title,
      location: j.location?.name || 'Not specified',
      url: j.absolute_url,
      description: j.content || '',
      companySlug: companyName,
      board: 'greenhouse'
    }));
  } catch (error) {
    console.error(`Error fetching ${companyName}:`, error.message);
    return [];
  }
}

app.get('/api/matching-jobs', async (req, res) => {
  try {
    console.log('Starting job fetch...');
    const allJobs = [];

    for (const c of TARGET_COMPANIES) {
      const jobs = await fetchGreenhouseJobs(c.greenhouse_id, c.name);
      allJobs.push(...jobs);
    }

    console.log(`Total jobs fetched: ${allJobs.length}`);

    const scored = allJobs
      .map(j => ({ ...j, score: scoreJob(j) }))
      .filter(j => j.score >= 3) // Lower threshold to show more results
      .sort((a, b) => b.score - a.score);

    console.log(`Jobs after filtering: ${scored.length}`);
    
    res.json(scored);
  } catch (err) {
    console.error('Error in /api/matching-jobs:', err);
    res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
  }
});

app.get('/', (_req, res) => {
  res.send('Job matcher backend is running. Visit /api/matching-jobs to see results.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
