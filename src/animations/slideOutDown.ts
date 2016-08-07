export const slideOutDown: ja.IAnimationPreset = {
  keyframes: [
    {
      transform: 'translate3d(0, 0, 0)',
      visibility: 'visible'
    },
    {
      visibility: 'hidden',
      transform: 'translate3d(0, 100%, 0)'
    }
  ],
  
    to: 1000
  ,
  name: 'slideOutDown'
};