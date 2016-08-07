export const slideInUp: ja.IAnimationPreset = {
  keyframes: [
    {
      transform: 'translate3d(0, 100%, 0)',
      visibility: 'hidden'
    },
    {
      transform: 'translate3d(0, 0, 0)',
      visibility: 'visible'
    }
  ],
  
    to: 1000
  ,
  name: 'slideInUp'
};