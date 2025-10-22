// index.js
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // IMPORTANT: parse JSON bodies

// In-memory store keyed by sha256 hash
const store = new Map();

/* ---------- Utility functions ---------- */

// compute SHA-256 hex
function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// count words (whitespace-separated)
function countWords(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// character frequency map (case-sensitive as spec didn't require lowering)
// If you want case-insensitive frequencies, normalize before counting
function charFreqMap(s) {
  const map = {};
  for (const ch of s) map[ch] = (map[ch] || 0) + 1;
  return map;
}

// palindrome check (case-insensitive, ignore spaces)
function isPalindrome(s) {
  const normalized = s.toLowerCase().replace(/\s+/g, "");
  // keep punctuation? The spec only says case-insensitive. We'll keep non-whitespace.
  return normalized === normalized.split("").reverse().join("");
}

// analyze string and return properties (must include sha256_hash inside properties)
function analyzeString(value) {
  const length = value.length;
  const is_palindrome = isPalindrome(value);
  const unique_characters = new Set(value).size;
  const word_count = countWords(value);
  const sha256_hash = sha256(value);
  const character_frequency_map = charFreqMap(value);

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map,
  };
}

/* ---------- Routes ---------- */

/**
 * POST /strings
 * Body: { "value": "string to analyze" }
 * Success: 201 Created with entry JSON
 * Duplicate: 409 Conflict
 * Missing: 400
 * Invalid type: 422
 */
app.post("/strings", (req, res) => {
  const body = req.body;
  if (!body || !Object.prototype.hasOwnProperty.call(body, "value")) {
    return res.status(400).json({ error: "Missing 'value' field in request body" });
  }
  const { value } = body;
  if (typeof value !== "string") {
    return res.status(422).json({ error: "'value' must be a string" });
  }

  const hash = sha256(value);
  if (store.has(hash)) {
    return res.status(409).json({ error: "String already exists in the system" });
  }

  const properties = analyzeString(value);
  const entry = {
    id: hash,
    value,
    properties,
    created_at: new Date().toISOString(),
  };

  store.set(hash, entry);
  return res.status(201).json(entry);
});

/**
 * GET /strings/:string_value
 * returns 200 with entry or 404 if not found
 * Note: :string_value is the raw string (URL-encoded when requested)
 */
app.get("/strings/:string_value", (req, res) => {
  const raw = req.params.string_value;
  // route param is URL-decoded by Express already
  const hash = sha256(raw);
  const entry = store.get(hash);
  if (!entry) return res.status(404).json({ error: "String not found" });
  return res.status(200).json(entry);
});

/**
 * GET /strings
 * Filtering via query params:
 *  - is_palindrome=true|false
 *  - min_length, max_length (integers)
 *  - word_count (integer)
 *  - contains_character=a (single character)
 */
app.get("/strings", (req, res) => {
  let results = Array.from(store.values());
  const filtersApplied = {};

  if (req.query.is_palindrome !== undefined) {
    const val = req.query.is_palindrome.toLowerCase();
    if (val === "true" || val === "false") {
      const boolVal = val === "true";
      filtersApplied.is_palindrome = boolVal;
      results = results.filter((r) => r.properties.is_palindrome === boolVal);
    } else {
      return res.status(400).json({ error: "is_palindrome must be true or false" });
    }
  }

  if (req.query.min_length !== undefined) {
    const n = parseInt(req.query.min_length, 10);
    if (Number.isNaN(n)) return res.status(400).json({ error: "min_length must be an integer" });
    filtersApplied.min_length = n;
    results = results.filter((r) => r.properties.length >= n);
  }

  if (req.query.max_length !== undefined) {
    const n = parseInt(req.query.max_length, 10);
    if (Number.isNaN(n)) return res.status(400).json({ error: "max_length must be an integer" });
    filtersApplied.max_length = n;
    results = results.filter((r) => r.properties.length <= n);
  }

  if (req.query.word_count !== undefined) {
    const n = parseInt(req.query.word_count, 10);
    if (Number.isNaN(n)) return res.status(400).json({ error: "word_count must be an integer" });
    filtersApplied.word_count = n;
    results = results.filter((r) => r.properties.word_count === n);
  }

  if (req.query.contains_character !== undefined) {
    const ch = req.query.contains_character;
    if (typeof ch !== "string" || ch.length === 0) return res.status(400).json({ error: "contains_character must be a string" });
    filtersApplied.contains_character = ch;
    results = results.filter((r) => r.value.includes(ch));
  }

  return res.status(200).json({ data: results, count: results.length, filters_applied: filtersApplied });
});

/**
 * GET /strings/filter-by-natural-language?query=...
 * Very lightweight parser to interpret a small set of natural queries used in tests.
 */
app.get("/strings/filter-by-natural-language", (req, res) => {
  const q = req.query.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter" });

  const original = String(q);
  const low = original.toLowerCase();

  // parsed filters we'll attempt to derive
  const parsed = {};

  // patterns we support (based on spec examples)
  // 1) "all single word palindromic strings"
  if (/\b(single word|single-word|one word)\b/.test(low)) {
    parsed.word_count = 1;
  }
  if (/\bpalindromic\b|\bpalindrome\b/.test(low)) {
    parsed.is_palindrome = true;
  }

  // 2) "strings longer than 10 characters" -> min_length = 11
  const longerMatch = low.match(/longer than (\d+)/);
  if (longerMatch) {
    const num = parseInt(longerMatch[1], 10);
    if (!Number.isNaN(num)) parsed.min_length = num + 1;
  }

  // also support "longer than or equal to X" or "at least X" (optional)
  const atLeastMatch = low.match(/\bat least (\d+)\b/);
  if (atLeastMatch) {
    const num = parseInt(atLeastMatch[1], 10);
    if (!Number.isNaN(num)) parsed.min_length = num;
  }

  // 3) "palindromic strings that contain the first vowel" -> is_palindrome + contains_character=a (heuristic)
  if (/\bfirst vowel\b/.test(low)) {
    parsed.contains_character = "a"; // heuristic
  }

  // 4) "strings containing the letter z" -> contains_character=z
  const containsMatch = low.match(/containing (?:the letter )?([a-zA-Z0-9])/);
  if (containsMatch) {
    parsed.contains_character = containsMatch[1];
  }

  // If parsed is empty, we cannot interpret
  if (Object.keys(parsed).length === 0) {
    return res.status(400).json({ error: "Unable to parse natural language query" });
  }

  // Apply parsed filters
  let results = Array.from(store.values());
  if (parsed.is_palindrome !== undefined) results = results.filter((r) => r.properties.is_palindrome === parsed.is_palindrome);
  if (parsed.word_count !== undefined) results = results.filter((r) => r.properties.word_count === parsed.word_count);
  if (parsed.min_length !== undefined) results = results.filter((r) => r.properties.length >= parsed.min_length);
  if (parsed.contains_character !== undefined) results = results.filter((r) => r.value.includes(parsed.contains_character));

  return res.status(200).json({
    data: results,
    count: results.length,
    interpreted_query: {
      original,
      parsed_filters: parsed,
    },
  });
});

/**
 * DELETE /strings/:string_value
 */
app.delete("/strings/:string_value", (req, res) => {
  const raw = req.params.string_value;
  const hash = sha256(raw);
  if (!store.has(hash)) return res.status(404).json({ error: "String not found" });
  store.delete(hash);
  return res.status(204).send();
});

/* health and root */
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "String Analyzer API" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
