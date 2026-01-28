import openpyxl
from openpyxl import Workbook

def create_nnd_checklist():
    wb = Workbook()
    ws = wb.active
    ws.title = "NND_CS_Checklist"

    # 헤더 설정
    headers = ["Process", "Vision Type", "Category", "Item", "Period"]
    ws.append(headers)

    # 데이터 정의 (사용자 요청 기반)
    # 포맷: (Process, Vision Type, Category, Item, Period)
    rows = []

    # 공통 항목 생성 헬퍼
    def add_items(process, vision, category, items, period=1):
        for item in items:
            rows.append((process, vision, category, item, period))

    # --- 데이터 생성 로직 ---
    processes = ["음극", "양극"]
    
    for proc in processes:
        # 비전 타입 정의
        vision_types = ["통합", "포일", "NG"]
        if proc == "음극":
            vision_types.append("탈리")

        for vision in vision_types:
            # 1. 정합성
            consistency_items = [
                "탭 접어서 통합비전/마킹비전 셀 ID 매칭 확인",
                "엔코더 슬립 체크",
                "트리거 보드 신호 체크"
            ]
            add_items(proc, vision, "정합성", consistency_items)

            # 2. 하드웨어
            hw_items = [
                "조명 상태 및 점등 확인",
                "카메라 착상 및 고정 상태 확인"
            ]
            add_items(proc, vision, "하드웨어", hw_items)

            # 3. 소프트웨어
            sw_items = [
                "비전 프로그램 그래프 및 측정 데이터 확인",
                "검사항목 데이터 이미지 정상 출력 확인",
                "CSV 파일 생성 여부 확인",
                "SPC+ 통신 연동 체크",
                "메모리 점유율 및 PC 상태 체크",
                "PC 시간 동기화 확인"
            ]
            add_items(proc, vision, "소프트웨어", sw_items)

            # 4. 클리닝 (비전 타입별로 다를 수 있으나 일단 공통으로 넣고 특이사항 추가)
            cleaning_items = [
                "에어리어 조명 클리닝",
                "탭가이드 이물 확인 및 클리닝",
                "탭센서 클리닝",
                "룰러(Ruler) 클리닝"
            ]
            
            # 음극 클라 2번 조명 특이사항 (음극일 때만 추가하거나 특정 비전에 추가)
            if proc == "음극":
                 cleaning_items.append("음극 클라 2번 조명 이물 체크")

            add_items(proc, vision, "클리닝", cleaning_items)

    # 데이터 쓰기
    for row in rows:
        ws.append(row)

    # 파일 저장
    file_path = "CS_Checklist.xlsx" # Adjusted path since we run inside the folder
    wb.save(file_path)
    print(f"Created new Excel file at: {file_path}")

if __name__ == "__main__":
    create_nnd_checklist()
