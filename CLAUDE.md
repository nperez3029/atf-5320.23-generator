# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an NFA Form processor project that generates PDFs for ATF Form 5320.23 (National Firearms Act Responsible Person Questionnaire). The project consists of a client-side TypeScript application that uses mupdf.js for PDF manipulation and includes a complete HTML form with embedded JavaScript for form handling.

## Build Commands

- `npm run build` - Build production bundle
- `npm run dev` - Start development server on port 8080
- `npm run type-check` - Run TypeScript type checking without emitting files
- `nix build` - Build project using Nix (preferred for production)
- `nix flake check` - Validate Nix flake configuration

## Development Environment

The project uses:
- TypeScript with strict configuration
- Webpack for bundling with WebAssembly support for mupdf
- Development server with hot reload on port 8080
- Local state management via URL hash for form persistence
- Nix for reproducible builds and deployment

## Architecture

### Frontend (TypeScript/HTML)
- **Main entry**: `src/index.ts` - Contains PDF generation logic using mupdf.js
- **UI**: `index.html` - Complete form implementation with inline CSS and JavaScript
- **Form Features**:
  - Client-side form validation with inline error messages
  - URL hash-based state persistence for bookmarking
  - Dynamic field enabling/disabling based on form logic
  - Auto-formatting for phone numbers and SSNs
  - Clear buttons for individual sections and entire form

### Static Assets
- **PDF Template**: `static/f_5320.23_national_firearms_act_nfa_responsible_person_questionnaire.pdf` - Official ATF form template
- **Styles**: `static/styles.css` - Form styling
- **Client Scripts**: `static/form.js` - Additional form handling logic

## Key Implementation Details

### Form State Management
- Form data serialized to base64-encoded JSON in URL hash
- Automatic saving on input/change events with debouncing
- Special handling for default values (certification date defaults to today, only stored if different)

### PDF Integration
- Uses mupdf.js (WebAssembly) for client-side PDF processing
- Webpack configured with `experiments.asyncWebAssembly: true`
- Complex field mapping system between HTML form fields and PDF widget names
- Widget alignment corrections for proper PDF field positioning

### Security Features
- Restrictive Content Security Policy implemented
- All processing done client-side, no data sent to servers
- Privacy notice emphasizing local processing

### Nix Build System
- **Flake structure**: Uses `importNpmLock.buildNodeModules` for dependency management
- **Build process**: Links node modules, runs `npm run build`, copies output to `/dist`
- **Development shell**: Provides Node.js environment with proper module linking

## Form Field Mapping

The form includes complex field relationships:
- Question 3a address can auto-sync with Question 2
- Question 6 has "Answer All No" bulk operation
- Question 6m.2 depends on 6m.1 selection
- Question 8 UPIN input depends on "Yes" selection
- Various "Other" text inputs enabled by radio/checkbox selections

### PDF Widget Mapping
The TypeScript code contains extensive mapping between HTML form fields and PDF widget names:
- Checkbox/radio selections use a special `SELECTED` symbol
- Text fields are normalized to uppercase
- Date fields are formatted as MM/DD/YYYY
- Multi-line addresses are concatenated with newlines
- Special alignment corrections applied to specific widgets

## Testing

No formal test framework is currently configured. Manual testing involves:
1. Running `npm run dev` to start development server
2. Testing form validation and state persistence
3. Verifying PDF field mapping and generation

## Deployment

- **GitHub Pages**: Automatic deployment on push to main branch
- **Build artifacts**: Static files served from `/dist` directory
- **Nix integration**: Ensures reproducible builds across environments