import re

def build_standard_snake():
    # 1 to 32 snake
    # 1 vs 32, 16 vs 17, 9 vs 24, 8 vs 25
    # 5 vs 28, 12 vs 21, 13 vs 20, 4 vs 29
    # 3 vs 30, 14 vs 19, 11 vs 22, 6 vs 27
    # 7 vs 26, 10 vs 23, 15 vs 18, 2 vs 31
    zones = "ABCDEFGHIJKLMNOP"
    seeds = [f"1º{z}" for z in zones] + [f"2º{z}" for z in zones[::-1]] # 1-16: 1ºA-1ºP, 17-32: 2ºP-2ºA
    # wait, 17 should be 2ºA? If 17 is 2ºA, then seeds[16] = 2ºA. 
    # Let's say seeds = 1ºA..1ºP, 2ºA..2ºP
    
    seeds = {}
    for i, z in enumerate(zones):
        seeds[i+1] = f"1º{z}"
        # If snake, 2ºA is 32 or 17?
        # Usually 2ºA is 32, 2ºB is 31... so 1ºA plays 2ºA in final.
        seeds[32-i] = f"2º{z}"
        
    matches = [
        (1, 32), (16, 17), (9, 24), (8, 25),
        (5, 28), (12, 21), (13, 20), (4, 29),
        (3, 30), (14, 19), (11, 22), (6, 27),
        (7, 26), (10, 23), (15, 18), (2, 31)
    ]
    
    for i, (s1, s2) in enumerate(matches):
        print(f"{i+33}: {seeds[s1]} vs {seeds[s2]}")

print("--- STANDARD SNAKE ---")
build_standard_snake()

def build_fap_alternative():
    # Sometimes FAP uses a different seeding order for quarters.
    # 1, 16, 8, 9, 4, 13, 5, 12 ...
    pass
