import { Router } from 'express'
import citiesRouter     from './routes/cities'
import exhibitionsRouter from './routes/exhibitions'
import venuesRouter     from './routes/venues'
import categoriesRouter from './routes/categories'
import artFormsRouter   from './routes/artForms'
import authRouter       from './routes/auth'
import savedRouter      from './routes/saved'
import usersRouter      from './routes/users'
import adminRouter      from './routes/admin'
import telemetryRouter  from './routes/telemetry'

const router = Router()

router.use('/auth',       authRouter)
router.use('/cities',     citiesRouter)
router.use('/exhibitions', exhibitionsRouter)
// Deprecated alias: a shipped app build still calls /events. Remove once no
// client in the wild uses it.
router.use('/events',      exhibitionsRouter)
router.use('/venues',     venuesRouter)
// Deprecated in favour of /art-forms; kept until no shipped build calls it.
router.use('/categories', categoriesRouter)
router.use('/art-forms',  artFormsRouter)
// Superseded by /saved, which splits hearts from bookmarks. The old path
// stays mounted so an app build still in someone's hands keeps working.
router.use('/favorites',  savedRouter)
router.use('/saved',      savedRouter)
router.use('/users',      usersRouter)
router.use('/admin',      adminRouter)
// Public and unauthenticated by necessity — crashes before sign-in are the ones
// most worth seeing. Rate-limited and re-scrubbed inside the route.
router.use('/telemetry',  telemetryRouter)

export default router
