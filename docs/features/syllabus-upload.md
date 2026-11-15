# Syllabus upload

Create a class by uploading a syllabus. AI extracts the class name, professor, room,
meeting times and assignments into the Add-class form; the student reviews and saves.

## How to reach it (user)

Classes (`/classes`) → **Add class** (+) → tab **Syllabus Upload** → **Upload Syllabus**
(PDF, image, Word or text) → **Process Syllabus** → review → **Create Class**.

## What runs

- `api.generateAiClass('', file)` → edge `generate-class` → `prepareAiSource` (docx/txt to
  text; PDFs and images inline) → OpenAI with the syllabus prompt in `_shared/aiCore.mjs`.
- Nothing is written until **Create Class**: `classes` insert, then `schedule_slots`
  per meeting time and `assignments` per extracted assignment (client-side PostgREST).

## Drive it

```bash
node scripts/verify/riven-verify.mjs run syllabus-upload
```

Signs in as `pro` (onboarded, no classes), uploads `scripts/verify/fixtures/syllabus.txt`.
Asserts the form is filled (name, professor, assignments listed) and the saved class has
professor/room, meeting days `[1, 3]` and both assignments.

## Gotchas

- The file input's `accept` list contains `line/msword` (typo for `application/msword`);
  see the audit.
- `newbie` is redirected to onboarding; use an onboarded account.
