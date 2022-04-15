import express from 'express'
import ConnectorsController from './connectorsController'

const router = express.Router()

router.get('/connect/:connector', ConnectorsController.connect)
router.get('/callback/:connector', ConnectorsController.callback)
router.get('/sync/:connector', ConnectorsController.sync)

export default router

//http://localhost:5021/callback/facebook?code=AQBp2D51hUnwfaA8yxS_Hs2TomQkoxpT40fdOJSBj5rVtCPJ9rOYlZOxZDGn07dfWNd2fKmxFZTBVjHbuPVXYoesIzdyOgTJ4zIyjsTDT3svRnvkX9ylIuv0np2Os0h_2QdpxnHy8XfsWYQH83TPJeupYNX1dr_iUcn2lXQ-frOfO5w4f-oMenNgg2nkofTxe8Yl_y8nZ5T_8aFZPMwELZdgYgLMDyU2YTZZYeQOva9n-1YGPPujIzI-btEFxxxS-OPBq6pirh27AJT57-wtQS6GCWn-N7etENqCtMAo4P95QNvA2B4wqiApbTonbbkfWx6W0pNwflFXRqWMvVd75Hy7uV7sWXyHKVCcrI397rmBoObcS5Cz_6zr2F-KoOzHh0ZdyUOV7NRNiX3w-rBQsI1k#_=_