# Math Question Library

A complete static website with three portals. Open `index.html` after extracting the ZIP.

| Portal | File | Included questions |
| --- | --- | --- |
| Math League | `math-league.html` | 1,140 Grade 4 questions from 38 contests, 1988–89 through 2025–26 |
| AMC 8 | `amc8.html` | 1,025 questions from 41 contests: 1985–2020 and 2022–2026 |
| Combined | `combined.html` | All 2,165 questions from both collections |

These are the collections supplied and classified in this conversation, not a live connection to the contest websites. The Math League portal currently contains **Grade 4 only**. The supplied AMC 8 binder does not contain a 2021 paper.

## Open on your computer

1. Extract the entire ZIP into a folder.
2. Double-click `index.html` in that folder and choose a portal.
3. Keep the `assets` folder beside the four HTML files. Opening the HTML directly from inside the ZIP will not load the question bundles reliably.

No installation, Node.js, administrator access, API key, account login, or build command is needed to use the site. The files include all question images and data; there are no external fonts, analytics, or CDN dependencies.

## Publish with GitHub Pages using your browser

1. Create a GitHub repository, or open the repository where you want this website.
2. Choose **Add file → Upload files**. Drag the extracted **contents** of this folder into the upload area, including the `assets` folder. Upload the actual files, not the ZIP. `index.html` must be at the repository's top level for the setup below.
3. Commit the uploaded files to the branch you want to publish, typically `main`. If your repository requires a pull request, merge that request into the publishing branch.
4. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**. Select your publishing branch and **/(root)**, then **Save**.
5. When deployment finishes, use **Visit site** on that page. A project site normally has a URL like `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

All links are relative, so the site also works inside a project repository path. You can publish from a `docs` folder instead: place all the site files there and select `/docs` as the publishing folder.

GitHub's browser uploader accepts up to 100 files at once and up to 25 MiB per file. This package is arranged as a small set of question bundles below those limits. The empty `.nojekyll` file is included to serve the static files directly. If your file browser hides it, create an empty file with that exact name at the publishing root using GitHub's **Add file → Create new file**.

Official instructions:

- [Create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Choose a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Upload files using your browser](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

## Browse and print

- Select a topic in the tree. Include subtopics to explore a whole branch, or turn that option off to see questions assigned directly to the selected class.
- Filter by year, search words or question references, and filter by collection in the combined portal.
- The default order follows the classification tree, then contest year and question number. The other sort options change the year order.
- Use **Enlarge** when a diagram or mathematical expression is small on a phone.
- Select individual questions to assemble a practice sheet. Selection is stored in your browser on that device when local storage is available; it is not synchronized between devices.
- **Print filtered questions** prepares every matching question, including matches beyond the current screen's page. **Print selected** prepares the selected questions for the current portal. The print dialog opens after their images load. Large selections take longer; the preparation can be canceled.
- In the browser's print dialog, choose your printer or **Save as PDF**. Letter paper, portrait, 100% scale, and browser headers/footers turned off work well. Print double-sided to use fewer sheets.
- The print layout keeps each question together and removes the navigation, filters, and selection controls. The screen's page size is only for browsing.

## Classifications and content

The library retains the previous Math League tree. AMC 8 adds six teaching subcategories: Pythagorean Theorem and Right Triangles; Cylinders; Data Displays; Single-Event Probability; Multiple-Event Probability; and Mode/Range. The combined collection uses 118 categories in total.

Each question has one inferred primary teaching category. These assignments are organizational labels, not official contest tags. A question that also fits another topic is not duplicated. Parent topic counts include descendant questions when subtopics are included; the all-questions total counts each question once. The collection and the original year/question reference are shown on every card.

Original mathematics, answer choices, and diagrams are preserved as lossless high-resolution images. Search uses extracted or recognized text and can miss words or formulas inside images. The rendered question image is the authoritative version. **Answers and worked solutions are not included in these classified question collections**, so there is no answer-reveal control.

Source quirks retained: AMC 8 1995 Q6 repeats the label D for its last two choices; 2016 Q12 has an ambiguous final sentence about field-trip participants. The complete 2019 Q22 was recovered from another copy within the supplied binder. Shared context is included with 2001 Q8–Q9.

The contest questions and illustrations remain the work of their original authors and publishers. The package does not change their ownership or grant a new license to that content.

## Files and editing

- `index.html`: home page with three access portals.
- `math-league.html`, `amc8.html`, `combined.html`: the three collection pages.
- `assets/site.css`: colors, layout, responsive styles, and printing.
- `assets/app.js`: browsing, filtering, selection, image loading, and printing.
- `assets/data/catalog.js`: question references, searchable text, classification tree, and bundle references.
- `assets/data/questions-*.js`: shared question image bundles. All three portals reuse these files.

The HTML, CSS, and JavaScript are editable source files. To correct a question's classification, change its `topicId` in `catalog.js` to an existing topic ID; the counts and tree update automatically. Keep the question ID unchanged. Preserve the `window.QUESTION_CATALOG = ...` assignment and valid JavaScript syntax. Back up files before making edits.

To change the site name or introduction, edit the four HTML files. To change colors or spacing, edit `assets/site.css`. No compilation is required after editing. Upload the changed files to the same publishing folder.

If a portal reports that data or images could not load, check that the complete `assets` folder was uploaded without renaming files. If GitHub shows a 404, check that `index.html` is directly inside the selected publishing folder and that the latest deployment has finished.

## Validation

All 2,165 question images and classification assignments were checked against the prepared collections. Automated checks exercised the shipped JavaScript for portal counts, filters, pagination, question links, saved selections, history navigation, and printing complete filtered/selected sets. A live-browser rendering test was unavailable in the build environment, so mobile appearance and actual printer pagination still depend on the browser preview and print settings.
