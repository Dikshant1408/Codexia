# Development & Testing Guide

This guide details testing and extending Code Archaeologist.

---

## Testing Strategy

### 1. Unit Testing
We use Node.js's native test runner (`node:test`) for instant execution without transpiler overhead:
```bash
npm test
```

### 2. End-to-End Fixture Testing
The repository includes a self-constructing Git fixture in `examples/demo-project`.
Run:
```bash
npm run demo:init
```
This builds an isolated repository with 6 realistic Git commits demonstrating:
- Multi-version symbol evolution (`calculatePrice` v1 -> v2 -> v3)
- Real dependency falloff graph (Cart -> Checkout -> Payment)
- Structural logic duplication (UserService vs OrderService)
- Dead code module (LegacyTax)

### 3. Local Dashboard Inspection
To preview the dark-first forensic inspector UI:
```bash
npm run codearch dashboard -- --port 3456
```
Open `http://localhost:3456` in your browser.
