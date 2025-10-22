const express = require("express");
const crypto = require("crypto");
const { error } = require("console");

const app = express();

app.use(express.json());

const strDB = new Map();

function analyzeString(str) {
  const normalized = str.toLowerCase().replace(/\+s/g, "");
  const is_palindrome = normalized === normalized.split().reverse().join("");
  const unique_characters = new Set(str).size;
  const words = str.trim().split(/\+s/).filter(Boolean);
  const word_count = words.length;
  const sha_256_hash = crypto.createHash("sha256").update(str).digest("hex");

  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  return {
    length: str.length,
    is_palindrome,
    unique_characters,
    word_count,
    sha_256_hash,
    character_frequency_map: freq,
  };
}

app.post("/strings", (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: "value is missing" });
  }
  if (typeof value !== "string") {
    return res.status(422).json({ error: "value must be a string" });
  }
  const properties = analyzeString(value);
  const id = properties.sha_256_hash;

  if (strDB.has(id)) {
    return res.status(409).json({ error: "String already exists" });
  }

  const record = {
    id,
    value,
    properties,
    created_at: new Date().toISOString(),
  };

  strDB.set(id, record);
  return res.status(201).json(record)
});

app.get("/strings/:value", (req, res) => {
  const { value } = req.params;
  const hash = crypto.createHash("sha256").update(value).digest("hex");

  if (!strDB.has(hash)) {
    return res.status(404).json({ error: "String not found" });
  }

  return res.status(200).json(strDB.get(hash));
});

app.get("/strings", (req, res) => {
  let results = Array.from(strDB.values());
  const filters = {};

  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

  if (is_palindrome !== undefined) {
    filters.is_palindrome = is_palindrome === "true";
    results = results.filter(r => r.properties.is_palindrome === filters.is_palindrome);
  }

  if (min_length !== undefined) {
    filters.min_length = parseInt(min_length);
    results = results.filter(r => r.properties.length >= filters.min_length);
  }

  if (max_length !== undefined) {
    filters.max_length = parseInt(max_length);
    results = results.filter(r => r.properties.length <= filters.max_length);
  }

  if (word_count !== undefined) {
    filters.word_count = parseInt(word_count);
    results = results.filter(r => r.properties.word_count === filters.word_count);
  }

  if (contains_character !== undefined) {
    filters.contains_character = contains_character;
    results = results.filter(r => r.value.includes(contains_character));
  }

  return res.json({
    data: results,
    count: results.length,
    filters_applied: filters,
  });
});

app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const q = query.toLowerCase();
  const filters = {};

  if (q.includes("palindromic")) filters.is_palindrome = true;
  if (q.includes("single word")) filters.word_count = 1;
  if (q.includes("longer than")) {
    const match = q.match(/longer than (\d+)/);
    if (match) filters.min_length = parseInt(match[1]) + 1;
  }
  if (q.includes("containing the letter")) {
    const match = q.match(/letter (\w)/);
    if (match) filters.contains_character = match[1];
  }

  if (Object.keys(filters).length === 0) {
    return res.status(400).json({ error: "Unable to parse query" });
  }

  let results = Array.from(strDB.values());
  if (filters.is_palindrome !== undefined)
    results = results.filter(r => r.properties.is_palindrome);
  if (filters.word_count !== undefined)
    results = results.filter(r => r.properties.word_count === filters.word_count);
  if (filters.min_length !== undefined)
    results = results.filter(r => r.properties.length >= filters.min_length);
  if (filters.contains_character !== undefined)
    results = results.filter(r => r.value.includes(filters.contains_character));

  return res.json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  });
});

app.delete("/strings/:value", (req, res) => {
  const hash = crypto.createHash("sha256").update(req.params.value).digest("hex");

  if (!strDB.has(hash)) {
    return res.status(404).json({ error: "String not found" });
  }

  strDB.delete(hash);
  return res.status(204).send();
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
