# Prompt Record Schema

Use this shape for the final system entry package.

```json
{
  "partId": "string",
  "partName": "string",
  "status": "dry-run | web-run-complete | ready-to-write",
  "vehicleApplicability": ["string"],
  "canvasImage": "path-or-asset-id",
  "referenceImages": ["path-or-asset-id"],
  "prompt": "string",
  "negativePrompt": "string",
  "constraints": ["string"],
  "testRun": {
    "executed": false,
    "chatgptWeb": true,
    "variants": [
      {
        "id": "v1",
        "prompt": "string",
        "score": 0,
        "decision": "accept | revise | reject",
        "notes": "string",
        "outputImage": "path-or-empty"
      }
    ]
  },
  "opsNotes": "string"
}
```

## Required Before Write

- `partId`
- `partName`
- `canvasImage`
- at least one `referenceImages` item
- final `prompt`
- `status` set to `ready-to-write`
- explicit user request to write the package
