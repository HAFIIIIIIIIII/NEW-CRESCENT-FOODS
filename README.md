# Crescent Foods

Online lunch ordering for Crescent Public School. Parents or students log in, pick food, check out, and the school office sees every order with the total cash to collect. No more class-teacher collection before 8 AM.

## Menu
| Item | Price |
|---|---|
| Half Biriyani | ₹100 |
| Full Biriyani | ₹180 |
| Meals | ₹60 |

## Files
- `index.html`, `style.css`, `app.js`: the whole site (no build step)
- `students.csv`: login data. Columns: `student_id,password` are required; `name,class,division` are optional and pre-fill the checkout form.

## Run locally
The site reads `students.csv`, so open it through a local server (not by double-clicking):

```
python -m http.server 8000
```
Then visit http://localhost:8000

Sample student login: `CPS1001` / `pass1001`
Admin login (click "Admin login"): `admin` / `crescent@admin`

## Publish on GitHub Pages
1. Create a repository named `crescent-foods` and push these files.
2. Repo **Settings → Pages → Deploy from a branch → main / (root)**.
3. Your site will be at `https://<your-username>.github.io/crescent-foods/`.

## Settings (top of `app.js`)
- `adminId` / `adminPassword`: admin login
- `enforceCutoff` / `cutoffHour`: set `enforceCutoff: true` to block orders after 10 AM
- `menu`: names and prices

## Important limitations (read before real use)
1. **Orders are stored in the browser (localStorage).** On GitHub Pages there is no server, so the admin only sees orders placed from the same browser. To collect orders from many phones, swap the `Store` object in `app.js` for Firebase Firestore, Supabase, or a Google Sheet. It only has three methods: `all`, `add`, `update`.
2. **`students.csv` and the admin password are public** once the repo is on GitHub Pages; anyone can open them. Use a private data source (backend login) before using real student data.
3. **Razorpay:** the `Payment.pay()` function in `app.js` is the single place to plug it in. Razorpay needs a small server to create orders and verify payments, so do it together with step 1.
