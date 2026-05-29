Urgent & important:

- [ ] Frontend & backend data structure bugs:

    - [ ] Age:
        - DOB should be asked in sign up form. Users under the age of 16 should be denied access.
        - In both /profile and /signup. Don't block users from entering any DOB, in the DOB field, it makes the UI too clunky. Limit it to invalidating and returning the error message.
        - [ ] Localize contry selection names in dropdown.

    - [ ] Navbar after logging
        - Navbar after logging should show:
            - [X] Logo on left (goes to "/")
            - On the right:
                - [ ] Home (goes to "/")
                - [ ] Dashboard
                - [ ] Profile
                - [ ] Log out
                - [X] Language switcher

    - [ ] /profile better UI
        - Currently, /profile shows everything in the same "page".
        - [ ] Move UTC timezone to "personal information" section (under phone number).
        - [ ] Remove "User concerns" section entirely. Remove "User concerns" as a field in the backend/db as well.
        - [ ] Remaining sections should not be stacked one on top of each other. Create a sidebar in /profile and only show the selected section. Users thought they must input/change their password for profile info to be saved, this is not the case.
        - [ ] Rename "ProfileSideBar" to "DashboardSideBar" for clarity and differentiation.



- Other changes:
    - [ ] 

- [ ] S3 integration for file storage
- [ ] i18n support for English and Spanish (ongoing — auth + profile namespaces done)

Important:
- [ ] 

Optional:
- Add data scaffolding for Patients' data browsing history (future API, won't be implemented in demo)
