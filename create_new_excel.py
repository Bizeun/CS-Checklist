import openpyxl
from openpyxl import Workbook

def create_nnd_checklist():
    wb = Workbook()
    ws = wb.active
    ws.title = "NND_CS_Checklist"

    # 헤더 설정: Item_EN 추가
    headers = ["Process", "Vision Type", "Category", "Item", "Item_EN", "Period"]
    ws.append(headers)

    rows = []

    # 헬퍼 수정: item_ko, item_en 쌍을 받음
    def add_items(process, vision, category, items_pair, period=1):
        for item_ko, item_en in items_pair:
            rows.append((process, vision, category, item_ko, item_en, period))

    processes = ["음극", "양극"] 
    
    for proc in processes:
        # 1. [최우선] 정합성 - 공통
        consistency_items = [
            ("탭 접어서 통합비전/마킹비전 셀 ID 매칭 확인", "Fold tab and check Cell ID matching (Integrated/Marking Vision)"),
            ("엔코더 슬립 체크", "Check Encoder Slip"),
            ("트리거 보드 신호 체크", "Check Trigger Board Signal")
        ]
        add_items(proc, "공통", "정합성", consistency_items)

        # 2. 소프트웨어 - 공통
        sw_items = [
            ("비전 프로그램 그래프 및 측정 데이터 확인", "Check Vision Program Graphs & Measurement Data"),
            ("검사항목 데이터 이미지 정상 출력 확인", "Check Inspection Item Data & Image Output"),
            ("CSV 파일 생성 여부 확인", "Verify CSV File Creation"),
            ("SPC+ 통신 연동 체크", "Check SPC+ Communication Link"),
            ("메모리 점유율 및 PC 상태 체크", "Check Memory Usage & PC Status"),
            ("PC 시간 동기화 확인", "Verify PC Time Synchronization")
        ]
        add_items(proc, "공통", "S/W", sw_items)

        # 3. 하드웨어 & 클리닝 - 공통
        hw_common_items = [
            ("조명 상태 및 점등 확인", "Check Lighting Status & Illumination"),
            ("카메라 착상 및 고정 상태 확인", "Check Camera Mounting & Fixation"),
            ("탭 센서 및 탭 가이드 이물 확인 및 클리닝", "Check/Clean Tab Sensor & Tab Guide (Dust/Tiny Particles)"),
            ("롤러(Roller) 클리닝", "Clean Roller")
        ]
        add_items(proc, "공통", "H/W & 클리닝", hw_common_items)

        # 4. 비전 타입별 전용 항목
        
        # 4-1. 통합 비전 전용
        integrated_items = [
            ("클라이언트 2번 조명 이물 확인 후 클리닝", "Check and Clean Client #2 Lighting for Dust/Tiny Particles")
        ]
        add_items(proc, "통합", "H/W & 클리닝", integrated_items)

        # 4-2. 탈리 비전 전용 (음극에만)
        if proc == "음극":
            tali_items = [
                ("탈리비전 즉정지 알람 시 작업자 스크랩 조치 확인", "Verify Operator Scrap Action on Delamination Vision Stop Alarm")
            ]
            add_items(proc, "탈리(Delamination)", "H/W & 클리닝", tali_items)

    # 데이터 쓰기
    for row in rows:
        ws.append(row)

    # 파일 저장
    file_path = "CS_Checklist.xlsx"
    wb.save(file_path)
    print(f"Created new NND Excel file at: {file_path}")

if __name__ == "__main__":
    create_nnd_checklist()
