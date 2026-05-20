import { Router } from 'express'
import citiesRouter     from './routes/cities'
import eventsRouter     from './routes/events'
import categoriesRouter from './routes/categories'
import authRouter       from './routes/auth'
import favoritesRouter  from './routes/favorites'
import usersRouter      from './routes/users'
import adminRouter      from './routes/admin'

const router = Router()

router.use('/auth',       authRouter)
router.use('/cities',     citiesRouter)
router.use('/events',     eventsRouter)
router.use('/categories', categoriesRouter)
router.use('/favorites',  favoritesRouter)
router.use('/users',      usersRouter)
router.use('/admin',      adminRouter)

export default router
