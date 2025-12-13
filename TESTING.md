# TESTING CHECKLIST
> Go through this checklist before pushing to dev and main

- login as admin
  - create new chain
  - create new home
  - create user
  - upload files to home
- login as user
  - test each page for correct data
  - test moving dates
  - test graphs
  - test exporting (pdf and excel)
    - reference exp
- test delete user and chain
  - verify deletion   
- run `npm test` and verify output
- run `npm run build` and verify no errors