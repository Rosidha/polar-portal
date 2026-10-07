# Polar Science Portal (NCPOR - SIH Problem 26063)

Three logins (Public, Scientist, Admin) with an approval workflow.
Stack: Node.js + Express, MongoDB (Mongoose), JWT auth, plain HTML/CSS/JS frontend served by the same server.

## 1. Install the tools
- Node.js 18+ (https://nodejs.org)
- MongoDB Community Server (https://www.mongodb.com/try/download/community) and start it. Optional: MongoDB Compass to view data.

## 2. Open and run in VS Code
1. Unzip, then in VS Code choose File > Open Folder > `polar-portal`.
2. Open the terminal (Ctrl + `) and run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:5000

On the first start the server connects to MongoDB, creates the database `polarportal`, and seeds the admin account plus sample articles.

## 3. Connect the database
Edit `.env`:
```
MONGO_URI=mongodb://127.0.0.1:27017/polarportal
```
Using MongoDB Atlas (cloud) instead? Create a free cluster, add a database user, allow your IP, then paste its connection string:
```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/polarportal
```
Change `JWT_SECRET` to a long random string before deploying.

## 4. Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@polar.in | Admin@123 |
| Scientist | scientist@polar.in | Sci@12345 |
| Public | public@polar.in | Public@123 |

On the login page pick the matching role tab first. New public users and scientists can register; admin accounts exist only through the seed (set ADMIN_EMAIL / ADMIN_PASSWORD in `.env` before the first run).

## 5. How it works
- **Public:** search, region filters, trending (most viewed), read approved articles and papers, comment after logging in.
- **Scientist:** submit an article or research paper, which starts as *pending*. Track Pending / Approved / Rejected with the admin's note, see views and public comments on their work, and browse other research.
- **Admin:** stats overview, approve or reject submissions (with a note), delete content, enable or disable users, remove comments.

## 6. Folder structure
```
server.js        API, MongoDB models, auth, seed data
public/          index.html, style.css, app.js (single-page frontend)
public/img/      polar scene illustrations (SVG)
.env             database and secret settings
```

## 7. API summary
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/articles?q=&category=`, `GET /api/articles/trending`, `GET /api/articles/:id`, `POST /api/articles/:id/comments`
- Scientist: `POST|GET /api/my/articles`, `GET /api/my/comments`
- Admin: `GET /api/admin/stats|articles|users|comments`, `PATCH /api/admin/articles/:id`, `PATCH /api/admin/users/:id`, `DELETE` for articles and comments

## 8. Using your own photos
The built-in illustrations are SVG files in `public/img/`. To use real photographs, drop `.jpg` files in that folder and change the `IMG` map and the `img()` function at the top of `public/app.js` (for example `aurora` to `aurora.jpg`). Use only images you have rights to, such as NCPOR's own or Unsplash.

## Troubleshooting
- `MongoDB connection failed`: MongoDB is not running. On Windows start the "MongoDB" service, on Mac run `brew services start mongodb-community`.
- Port in use: change `PORT` in `.env`.
- Reset demo data: delete the `polarportal` database in Compass and restart.
