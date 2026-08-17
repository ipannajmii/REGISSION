# REGISSION Detection Pipeline

```text
Camera â†’ YOLOv8 Board Segmentation â†’ Board Locking â†’ OpenCV Perspective Warp
      â†’ Normalized 8Ã—8 Board
      â†’ YOLOv8 Piece Detection + OpenCV Visual Difference
      â†’ Square-Level Evidence
      â†’ python-chess Legal Candidates
      â†’ FEN + Side-to-Move Verification
      â†’ SAN â†’ Laravel REST API
```

The board model identifies the board region and stabilized corners. OpenCV normalizes it to a top-down 8Ã—8 board. The piece model and frame/image difference provide square-level evidence. python-chess maintains the authoritative legal state, limits candidates to legal moves, protects side-to-move order and generates SAN. AUTO is the primary workflow; Resume Detect is a backup/manual trigger using the same underlying pipeline.
