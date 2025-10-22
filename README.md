## *String Analyzer API**

A RESTful API that analyzes strings and computes various properties like length, palindrome check, unique characters, and more.
It also supports filtering and retrieval of analyzed strings.

---

## **Features**

* Analyze strings and store their computed properties
* Retrieve one or all stored strings
* Filter results using query parameters or natural language
* Compute:

  *  String length
  *  Palindrome check (case-insensitive)
  *  Unique character count
  *  Word count
  *  SHA-256 hash
  *  Character frequency map

---

## **Tech Stack**

* **Node.js** (Runtime)
* **Express.js** (Web framework)
* **Crypto** (For SHA-256 hashing)


---

## **Project Setup**

### ** Clone the Repository**

```bash
git clone https://github.com/middo1/string-analyzer-api.git
cd string-analyzer-api
```

### ** Install Dependencies**

```bash
npm install
```


### ** Run the Server**

```bash
npm start
```

The API will be available at:
 `http://localhost:5000`

---

## **Testing the API Using Postman**

### ** POST /strings**

Analyze a new string.

**URL:**

```
POST http://localhost:5000/strings
```

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "value": "madam"
}
```

**Response:**

```json
{
  "id": "5d41402abc4b2a76b9719d911017c592",
  "value": "madam",
  "properties": {
    "length": 5,
    "is_palindrome": true,
    "unique_characters": 3,
    "word_count": 1,
    "sha256_hash": "abc123...",
    "character_frequency_map": {
      "m": 2,
      "a": 2,
      "d": 1
    }
  },
  "created_at": "2025-10-18T14:25:00.000Z"
}
```

---

### ** GET /strings**

Fetch all analyzed strings.

**URL:**

```
GET http://localhost:5000/strings
```

**Response:**

```json
{
  "data": [
    {
      "id": "abc123...",
      "value": "madam",
      "properties": {
        "length": 5,
        "is_palindrome": true,
        "unique_characters": 3,
        "word_count": 1,
        "sha256_hash": "abc123...",
        "character_frequency_map": { "m": 2, "a": 2, "d": 1 }
      },
      "created_at": "2025-10-18T14:25:00.000Z"
    }
  ],
  "count": 1
}
```

---

### ** GET /strings/{string_value}**

Retrieve analysis for a specific string.

```
GET http://localhost:5000/strings/madam
```

---

### ** DELETE /strings/{string_value}**

Delete a string entry.

```
DELETE http://localhost:5000/strings/madam
```

**Response:**

```
204 No Content
```

---

### ** GET /strings/filter-by-natural-language**

Filter results using plain English queries.

```
GET http://localhost:5000/strings/filter-by-natural-language?query=all single word palindromic strings
```

**Response Example:**

```json
{
  "data": [ /* filtered strings */ ],
  "count": 3,
  "interpreted_query": {
    "original": "all single word palindromic strings",
    "parsed_filters": {
      "word_count": 1,
      "is_palindrome": true
    }
  }
}
```

---

## **Error Responses**

| Status Code | Description                               |
| ----------- | ----------------------------------------- |
| 400         | Invalid request body or query parameters  |
| 404         | String not found                          |
| 409         | String already exists                     |
| 422         | Invalid data type or unprocessable entity |

---
