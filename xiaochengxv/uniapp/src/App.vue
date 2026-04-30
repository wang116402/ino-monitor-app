<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('App Launch')
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.container {
  padding: 20rpx;
}

.card {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.btn {
  background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  font-weight: 500;
}

.btn-danger {
  background: linear-gradient(135deg, #ea4335 0%, #c53929 100%);
}

.btn-success {
  background: linear-gradient(135deg, #34a853 0%, #2e8b4a 100%);
}

.switch-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.switch {
  width: 120rpx;
  height: 64rpx;
  background: #e0e0e0;
  border-radius: 32rpx;
  position: relative;
  transition: background 0.3s;
  
  &.active {
    background: #1a73e8;
    
    .switch-handle {
      transform: translateX(56rpx);
    }
  }
  
  .switch-handle {
    width: 56rpx;
    height: 56rpx;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 4rpx;
    left: 4rpx;
    transition: transform 0.3s;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
  }
}
</style>
