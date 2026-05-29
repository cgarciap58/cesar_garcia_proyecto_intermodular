Urgent & important:
- [ ] Fix /profile page not loading, possibly due to broken JS regarding reactjs-datepicker

- [ ] Frontend bugs refactor (validation formulas should live in a single place):
    - [ ] Every name and last name input field (signin, profile) should allow typing of:
        - [X] Uppercase and lowercase letters
        - [X] Vowels with accents "ÁÉÍÓÚáéíóú"
        - [X] Hyphen "-", space " ", apostrophe "'"
    - [ ] Every email input field (signin, profile) should allow typing of:
        - [ ] Uppercase and lowercase letters
        - [ ] Numbers
        - [ ] Special characters "@", ".", "_", "-"
    - [ ] Every phone input field (signin, profile) should allow typing of:
        - [ ] Numbers
        - [ ] Special characters "+", "-"
    - [ ] Every date input field (signin, profile) should allow typing of:
        - [ ] Numbers
        - [ ] Special characters "/", "-"
        - [ ] Dates should use DD/MM/YYYY format with reactjs-datepicker
        - [ ] Dates in the database should be stored as date type

    - Error handling should follow these principles:
        - [ ] If any validation fails, an error message should be displayed exactly below the submit button
        - [ ] Each specific error should be displayed under its pertaining field
        - [ ] All errors must be localized, including those coming from the backend

- [ ] Backend validation for all input fields.
    - [ ] Never trust front-end validation as it can be bypassed. Everything should be validated.
    - [ ] No hard-coded validation error messages in backend.
    - [ ] Validation errors should return type of validation error, then pass it through i18n on frontend.

    - [ ] Every name and last name input field (signin, profile) should allow:
        - [ ] Uppercase and lowercase letters
        - [ ] Vowels with accents "ÁÉÍÓÚáéíóú"
        - [ ] Hyphen "-", space " ", apostrophe "'"
    - [ ] Every email input field (signin, profile) should allow:
        - [ ] Uppercase and lowercase letters
        - [ ] Numbers
        - [ ] Special characters "@", ".", "_", "-"
    - [ ] Phone input field (signin, profile) should allow:
        - [ ] Country code prefix (e.g., +34)
        - [ ] Numbers
    - [ ] Every date input field (signin, profile) should allow:
        - [ ] Numbers
        - [ ] Special characters "/", "-"
        - [ ] Dates should use DD/MM/YYYY format with reactjs-datepicker
        - [ ] Dates in the database should be stored as date type

    - Error handling should follow these principles:
        - [ ] If any validation fails, an error message should be displayed exactly below the submit button
        - [ ] If anything fails during backend verification, create an array of errors and pass them to ReactJS. ReactJS should display "Some fields are invalid" message (localised) below submit button, as well as the specific error messages (localized) below each specific invalid field.
        - [ ] Each specific error should be displayed under its pertaining field
        - [ ] All errors must be localized, including those coming from the backend


- [ ] S3 integration for file storage
- [ ] i18n support for English and Spanish

Important:
- [ ] 

Optional:

- Add data scaffolding for Patients' data browsing history (future API, won't be implemented in demo)
- Add demo data of patient's browser history (future API, won't be implemented in demo)
- Divide /profile by adding a sidebar on the left side with links to different sections (like 3 sub-pages inside that page)