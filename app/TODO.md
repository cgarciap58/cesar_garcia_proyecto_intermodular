Urgent & important:
- [ ] Frontend bugs refactor (validation formulas should live in a single place):
    - [ ] Every name and last name input field (signin, profile) should allow typing of:
        - [ ] Uppercase and lowercase letters
        - [ ] Vowels with accents "ÁÉÍÓÚáéíóú"
        - [ ] Hyphen "-", space " ", apostrophe "'"
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
- [ ] S3 integration for file storage
- [ ] i18n support for English and Spanish

Important:
- [ ] 

Optional:

- Add data scaffolding for Patients' data browsing history (future API, won't be implemented in demo)
- Add 