/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./static/**/*.{html,js}",  // Tailwind가 이 파일들을 스캔해서 사용된 클래스를 찾습니다
  ],
  theme: {
    extend: {
      // 여기서 프로젝트만의 커스텀 색상, 폰트 등을 추가할 수 있습니다
      colors: {
        // 현재 프로젝트에서 사용하는 보라색 그라데이션
        'brand-purple': '#667eea',
        'brand-purple-dark': '#764ba2',
        // 음극 (Anode) - 파란색
        'anode-light': '#4dabf7',
        'anode-dark': '#339af0',
        'anode-border': '#1971c2',
        // 양극 (Cathode) - 빨간색
        'cathode-light': '#ff6b6b',
        'cathode-dark': '#ee5a6f',
        'cathode-border': '#c92a2a',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
