# Archived AFGH Logic

This folder contains the original AFGH (Ateniese-Fu-Green-Hohenberger) proxy re-encryption implementation that was used in the frontend.

## Why Archived?

The AFGH implementation has been moved out of the frontend to:
1. Simplify the frontend to focus on UI/UX
2. Prepare for integration with pyUmbrel (Python library) for encryption/decryption
3. Move crypto operations to a dedicated gateway/backend service

## Contents

### Services
- `afghService.ts` - Core AFGH implementation (Level 1/2 encryption, re-encryption keys)
- `afghFileService.ts` - Hybrid KEM-DEM file encryption using AFGH
- `afghStorageService.ts` - Secure key storage in IndexedDB

### Types
- `afgh.ts` - TypeScript type definitions for AFGH operations

## Future Integration

This logic will be reimplemented using pyUmbrel on the backend/gateway side to handle:
- Client-side encryption/decryption
- Gateway re-encryption operations
- Key management

## Date Archived
November 17, 2025
