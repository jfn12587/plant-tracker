#!/bin/bash
git add -A && git commit -m "Default to showing only logged-in caretaker's plants

- Filter bar defaults to 'My Plants' (matches caretaker field to signed-in user)
- Toggle to 'All Plants' to see everything
- Applies to both scheduled and unscheduled plant sections
- Filter persists across navigation like other filters
- Product and system specs updated" && git push
