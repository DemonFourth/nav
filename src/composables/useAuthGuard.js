import { useAuth } from './useAuth'
import { useToast } from './useToast'

let loginModalInstance = null

export function useAuthGuard() {
  const setLoginModalInstance = (instance) => {
    loginModalInstance = instance
  }

  const requireAuth = () => {
    const { validateAuthState } = useAuth()

    if (validateAuthState()) {
      return true
    }

    // 登录框本身就是反馈，再弹「请先登录」toast 属于重复提示；
    // 只有在没有可弹实例（例如默认模式下尚未注册）时才用 toast 兜底。
    if (loginModalInstance) {
      loginModalInstance.open()
    } else {
      const { warning } = useToast()
      warning('请先登录')
    }
    return false
  }

  return { setLoginModalInstance, requireAuth }
}
