import { useAuth } from './useAuth'
import { useToast } from './useToast'

let loginModalInstance = null

export function useAuthGuard() {
  const setLoginModalInstance = (instance) => {
    loginModalInstance = instance
  }

  const requireAuth = () => {
    const { validateAuthState } = useAuth()
    const { warning } = useToast()

    if (validateAuthState()) {
      return true
    }

    warning('请先登录')
    loginModalInstance?.open()
    return false
  }

  return { setLoginModalInstance, requireAuth }
}
