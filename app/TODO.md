Urgent & important:

- [ ] Frontend bugs:

    - [ ] "Home" button should be a link to "/", but if it's alredy there, it should move to the top of the page, instead of staying wherever it already is. Same goes for the button that also takes to "/".
    - [ ] Credits should be shown everywhere as a float with one decimal place. Currently there are some inconsistencies either visual or in the computation. If a psych costs 1.5 then 1.5 should clearly be deducted from user's purse.

- [ ] Frontend/backend bugs:
    - [ ] Add the same validation that "First Name" has to the "City" field.

- [ ] Remaining / follow-up:
    - [ ] seed_demo.py still seeds `concerns` — update to not set it (will error after migration).
    - [ ] admin.py still shows `concerns` in PatientProfileAdmin list_display — remove it. Does it though?-->
    - [ ] Backend validation for signup: email format check (currently trusts the client). Does it though? 


Important:
    - [ ] S3 integration for file storage
    - [ ] 

Optional:
- Add data scaffolding for Patients' data browsing history (future API, won't be implemented in demo)
