'use client';
// app/courses/[id]/lessons/[lessonId]/page.tsx
//
// FOLDER STRUCTURE (must match exactly):
//   app/courses/[id]/lessons/[lessonId]/page.tsx
//   └─> URL: /courses/<id>/lessons/<lessonId>
//
// NOTE ON NEXT.JS 15+ ASYNC PARAMS:
//   `await params` only works in SERVER components. This file is a
//   CLIENT component ('use client'), so we must use the `useParams()`
//   hook, which returns the params object synchronously.
//
//   ✔ Client component  → useParams()          (used below)
//   ✔ Server component  → const { id } = await params

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Volume2,
  ImageIcon,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Trophy,
} from 'lucide-react';

interface Lesson {
  id: string;
  lessonNumber: number;
  title: string;
  images: string[];
  audioUrl: string;
}

// ---------------------------------------------------------------------------
// Normalized option / question shapes used across ALL quiz tables
// ---------------------------------------------------------------------------
interface NormalizedOption {
  label: string; // 'ሀ' | 'ለ' | 'ሐ' | 'መ' | 'A' | 'B' ...
  text: string;  // the actual option text stored in the DB
}

interface NormalizedQuestion {
  id: number | string;
  question_text: string;
  options: NormalizedOption[];
  correctAnswerText: string; // resolved to the option *text* for uniform scoring
  raw: any;
}

interface SavedScore {
  score: number;
  total: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// 1) ኡሱሉ ሰላሳ (Usul as-Salasa)
// ---------------------------------------------------------------------------
const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    lessonNumber: 1,
    title: 'ኡሱሉ ሰላሳ - ደርስ 1',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262313/usul_page-0001_ggoscs.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262317/usul_page-0002_gioxtw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262319/usul_page-0003_ugsaxy.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086041/usul_01_kqsvq9.mp3',
  },
  {
    id: 'lesson-2',
    lessonNumber: 2,
    title: 'ኡሱሉ ሰላሳ - ደርስ 2',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262319/usul_page-0003_ugsaxy.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262318/usul_page-0004_zhpnbr.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0005_qcc0r5.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086861/usul_02_odav3e.mp3',
  },
  {
    id: 'lesson-3',
    lessonNumber: 3,
    title: 'ኡሱሉ ሰላሳ - ደርስ 3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0005_qcc0r5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0006_xu2dnj.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262320/usul_page-0007_qncmo0.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086248/usul_03_fxeztt.mp3',
  },
  {
    id: 'lesson-4',
    lessonNumber: 4,
    title: 'ኡሱሉ ሰላሳ - ደርስ 4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262320/usul_page-0007_qncmo0.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262321/usul_page-0008_nwrosz.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086354/usul_04_vbsihg.mp3',
  },
  {
    id: 'lesson-5',
    lessonNumber: 5,
    title: 'ኡሱሉ ሰላሳ - ደርስ 5',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262321/usul_page-0009_hpnrur.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0010_ijgcx3.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086564/usul_05_kp4dgz.mp3',
  },
  {
    id: 'lesson-6',
    lessonNumber: 6,
    title: 'ኡሱሉ ሰላሳ - ደርስ 6',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0010_ijgcx3.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0011_a7dyqn.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262323/usul_page-0012_zmekuh.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262324/usul_page-0013_bkkyyu.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262328/usul_page-0014_nark7n.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786087471/usul_06_qfqvwc.mp3',
  },
  {
    id: 'lesson-7',
    lessonNumber: 7,
    title: 'ኡሱሉ ሰላሳ - ደርስ 7',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0015_nkk5rw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0016_wcn4ot.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0017_fo0bpb.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086388/usul_07_bpdh2m.mp3',
  },
  {
    id: 'lesson-8',
    lessonNumber: 8,
    title: 'ኡሱሉ ሰላሳ - ደርስ 8',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262325/usul_page-0017_fo0bpb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0018_usotos.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0019_imspvj.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086368/usul_08_ihnjwm.mp3',
  },
  {
    id: 'lesson-9',
    lessonNumber: 9,
    title: 'ኡሱሉ ሰላሳ - ደርስ 9',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0019_imspvj.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262327/usul_page-0020_lhz2jm.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262329/usul_page-0021_witcu9.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262328/usul_page-0022_jnqqpt.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086184/usul_09_vqwvym.mp3',
  },
  {
    id: 'lesson-10',
    lessonNumber: 10,
    title: 'ኡሱሉ ሰላሳ - ደርስ 10',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262330/usul_page-0023_ikoxoz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0024_l1me8e.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262333/usul_page-0025_imqogl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0026_kqlwsq.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086404/usul_10_avocbi.mp3',
  },
  {
    id: 'lesson-11',
    lessonNumber: 11,
    title: 'ኡሱሉ ሰላሳ - ደርስ 11',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262331/usul_page-0026_kqlwsq.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786262332/usul_page-0027_am2v56.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786086279/usul_11_zlrzrj.mp3',
  },
];

// ---------------------------------------------------------------------------
// 2) አርባኢን ነወዊ (Arba'in An-Nawawi)
// ---------------------------------------------------------------------------
const lessonsArbaeen: Lesson[] = [
  {
    id: 'arbaeen-lesson-1',
    lessonNumber: 101,
    title: 'አርባኢን ነወዊ - ደርስ 1',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691533/arbain-image_page-0001_soy3pt.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691534/arbain-image_page-0002_stnuky.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691534/arbain-image_page-0003_wsmu9u.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0004_msky4g.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0005_svoclw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0006_u3nchl.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691144/arbain-01.mp3_spzu5j.mp3',
  },
  {
    id: 'arbaeen-lesson-2',
    lessonNumber: 102,
    title: 'አርባኢን ነወዊ - ደርስ 2',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691536/arbain-image_page-0007_cuo3xl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691537/arbain-image_page-0008_mz70pw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691539/arbain-image_page-0009_ug7sc9.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691541/arbain-image_page-0010_yhttnz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0011_ov2joc.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0012_u8xr9w.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691543/arbain-image_page-0013_ujralo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691545/arbain-image_page-0014_ddsk3f.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691150/arbain-02.mp3_mzd2x4.mp3',
  },
  {
    id: 'arbaeen-lesson-3',
    lessonNumber: 103,
    title: 'አርባኢን ነወዊ - ደርስ 3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691546/arbain-image_page-0015_bkaumo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691548/arbain-image_page-0016_nwtudl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691548/arbain-image_page-0017_wdwqnk.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691094/arbain-03.mp3_ios6v6.mp3',
  },
  {
    id: 'arbaeen-lesson-4',
    lessonNumber: 104,
    title: 'አርባኢን ነወዊ - ደርስ 4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691549/arbain-image_page-0018_fewrnd.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691550/arbain-image_page-0019_kll7qy.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691551/arbain-image_page-0020_dleihi.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691039/arbain-04.mp3_ih6yfn.mp3',
  },
  {
    id: 'arbaeen-lesson-5',
    lessonNumber: 105,
    title: 'አርባኢን ነወዊ - ደርስ 5',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691553/arbain-image_page-0021_yhrczu.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691553/arbain-image_page-0022_njihop.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691556/arbain-image_page-0023_tkq3s5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691557/arbain-image_page-0024_fu20fy.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691044/arbain-05.mp3_jbpdij.mp3',
  },
  {
    id: 'arbaeen-lesson-6',
    lessonNumber: 106,
    title: 'አርባኢን ነወዊ - ደርስ 6',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691558/arbain-image_page-0025_onybqq.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691558/arbain-image_page-0026_vlwrja.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691560/arbain-image_page-0027_dkwgvk.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691561/arbain-image_page-0028_cchx2t.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691562/arbain-image_page-0029_ws7bnl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691563/arbain-image_page-0030_fjbdft.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691059/arbain-06.mp3_ly19mh.mp3',
  },
  {
    id: 'arbaeen-lesson-7',
    lessonNumber: 107,
    title: 'አርባኢን ነወዊ - ደርስ 7',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691564/arbain-image_page-0031_f6msbw.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691565/arbain-image_page-0032_xxwil6.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691566/arbain-image_page-0033_uiae1n.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691567/arbain-image_page-0034_rnjlm7.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691568/arbain-image_page-0035_e8zw1k.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691130/arbain-07.mp3_mov7y7.mp3',
  },
  {
    id: 'arbaeen-lesson-8',
    lessonNumber: 108,
    title: 'አርባኢን ነወዊ - ደርስ 8',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691569/arbain-image_page-0036_jje1st.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691571/arbain-image_page-0037_vfzent.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691572/arbain-image_page-0038_i0cupy.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691129/arbain-08.mp3_hqf5ej.mp3',
  },
  {
    id: 'arbaeen-lesson-9',
    lessonNumber: 109,
    title: 'አርባኢን ነወዊ - ደርስ 9',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691573/arbain-image_page-0039_ojetbr.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691573/arbain-image_page-0040_yn38z0.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691574/arbain-image_page-0041_adcsco.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691575/arbain-image_page-0042_uvg3hl.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691576/arbain-image_page-0043_cbb0lf.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691166/arbain-09.mp3_w7obpw.mp3',
  },
  {
    id: 'arbaeen-lesson-10',
    lessonNumber: 110,
    title: 'አርባኢን ነወዊ - ደርስ 10',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691577/arbain-image_page-0044_dfvxkb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691578/arbain-image_page-0045_cdcenh.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691580/arbain-image_page-0046_yawnfs.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691581/arbain-image_page-0047_upy9p5.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691582/arbain-image_page-0048_diknbn.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691168/arbain-10.mp3_vqudpf.mp3',
  },
  {
    id: 'arbaeen-lesson-11',
    lessonNumber: 111,
    title: 'አርባኢን ነወዊ - ደርስ 11',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691584/arbain-image_page-0049_qshxqb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691585/arbain-image_page-0050_mlahum.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691586/arbain-image_page-0051_eijkab.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691587/arbain-image_page-0052_hzobrt.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691588/arbain-image_page-0053_nxcbhz.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786691590/arbain-image_page-0054_vx36su.jpg',
    ],
    audioUrl:
      'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786691176/arbain-11.mp3_evcigs.mp3',
  },
];

// ---------------------------------------------------------------------------
// 3) ሹሩጡ ሶላት (Shurut as-Salat)
// ---------------------------------------------------------------------------
const lessonsShurut: Lesson[] = [
  {
    id: 'shurut-lesson-1',
    lessonNumber: 1,
    title: 'የሹሩጡ ሶላት ትምህርት 1',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871287/shurut-1.mp3_duizft.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874171/shurut.pdf_page-0001_mqmsvs.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874165/shurut.pdf_page-0002_goedx2.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874167/shurut.pdf_page-0003_jmdpct.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874168/shurut.pdf_page-0004_xcmacg.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874169/shurut.pdf_page-0005_meqcc2.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874171/shurut.pdf_page-0006_lv0kit.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874171/shurut.pdf_page-0007_wduadc.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874173/shurut.pdf_page-0008_wa1uia.jpg',
    ],
  },
  {
    id: 'shurut-lesson-2',
    lessonNumber: 2,
    title: 'የሹሩጡ ሶላት ትምህርት 2',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871299/shurut-2.mp3_xsvcyk.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874175/shurut.pdf_page-0009_ufcbg6.jpg',
    ],
  },
  {
    id: 'shurut-lesson-3',
    lessonNumber: 3,
    title: 'የሹሩጡ ሶላት ትምህርት 3',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871309/shurut-3.mp3_ncmsly.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874176/shurut.pdf_page-0010_fqfmvd.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874176/shurut.pdf_page-0011_ikbvry.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874177/shurut.pdf_page-0012_vx5x6j.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874178/shurut.pdf_page-0013_jwe3fq.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874180/shurut.pdf_page-0014_a0pzlf.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874181/shurut.pdf_page-0015_rcgl9x.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874181/shurut.pdf_page-0016_vtkceb.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874182/shurut.pdf_page-0017_xgel8b.jpg',
    ],
  },
  {
    id: 'shurut-lesson-4',
    lessonNumber: 4,
    title: 'የሹሩጡ ሶላት ትምህርት 4',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871307/shurut-4.mp3_g7v4kj.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874184/shurut.pdf_page-0018_mr5z2w.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874185/shurut.pdf_page-0019_en0bkg.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874185/shurut.pdf_page-0020_zmap8j.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874187/shurut.pdf_page-0021_svgvwo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874188/shurut.pdf_page-0022_dktofp.jpg',
    ],
  },
  {
    id: 'shurut-lesson-5',
    lessonNumber: 5,
    title: 'የሹሩጡ ሶላት ትምህርት 5',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871302/shurut-5.mp3_pl7uqk.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874189/shurut.pdf_page-0023_l7iw7p.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874190/shurut.pdf_page-0024_zk6fho.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874191/shurut.pdf_page-0025_qxesg5.jpg',
    ],
  },
  {
    id: 'shurut-lesson-6',
    lessonNumber: 6,
    title: 'የሹሩጡ ሶላት ትምህርት 6',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871304/shurut-6.mp3_dqr6s4.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874191/shurut.pdf_page-0026_ladbau.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874194/shurut.pdf_page-0027_efyfoy.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874195/shurut.pdf_page-0028_khylvk.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874196/shurut.pdf_page-0029_okq7yi.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874196/shurut.pdf_page-0030_fzoz38.jpg',
    ],
  },
  {
    id: 'shurut-lesson-7',
    lessonNumber: 7,
    title: 'የሹሩጡ ሶላት ትምህርት 7',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786871327/shurut-7.mp3_u5u2jd.mp3',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874197/shurut.pdf_page-0031_mosh5o.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874197/shurut.pdf_page-0032_rpcqcr.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874198/shurut.pdf_page-0033_yjdyue.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786874203/shurut.pdf_page-0034_ucs9r8.jpg',
    ],
  },
];

// ---------------------------------------------------------------------------
// 4) ኡርጁዘቱል ሚኢያህ (Urjuzetul Mi'iyah) - 25 Lessons
// ---------------------------------------------------------------------------
const lessonsUrjuzetul: Lesson[] = [
  {
    id: 'urjuzetul-lesson-1',
    lessonNumber: 201,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 1',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967681/urjuzel-01.mp3_ecbljt.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970682/urjuzel.pdf_page-0001_jmqqum.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970683/urjuzel.pdf_page-0002_yvqlwi.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-2',
    lessonNumber: 202,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 2',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967657/urjuzel-02.mp3_vjnqtk.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970683/urjuzel.pdf_page-0002_yvqlwi.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-3',
    lessonNumber: 203,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 3',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967606/urjuzel-03.mp3_udd5tw.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970683/urjuzel.pdf_page-0003_zfihqo.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-4',
    lessonNumber: 204,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 4',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967769/urjuzel-04.mp3_axwxep.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970685/urjuzel.pdf_page-0004_jfyids.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970687/urjuzel.pdf_page-0005_fk1pbg.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-5',
    lessonNumber: 205,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 5',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967673/urjuzel-05.mp3_fjul8i.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970685/urjuzel.pdf_page-0004_jfyids.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970687/urjuzel.pdf_page-0005_fk1pbg.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-6',
    lessonNumber: 206,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 6',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967659/urjuzel-06.mp3_hjgisa.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970687/urjuzel.pdf_page-0005_fk1pbg.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970688/urjuzel.pdf_page-0006_ylgsq5.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-7',
    lessonNumber: 207,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 7',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967898/urjuzel-07.mp3_bcgdhm.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970688/urjuzel.pdf_page-0006_ylgsq5.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-8',
    lessonNumber: 208,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 8',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968400/urjuzel-08.mp3_lcci7q.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970688/urjuzel.pdf_page-0006_ylgsq5.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-9',
    lessonNumber: 209,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 9',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967914/urjuzel-09.mp3_pxwvgm.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970689/urjuzel.pdf_page-0007_bxhqsg.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-10',
    lessonNumber: 210,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 10',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786967891/urjuzel-10.mp3_lelznm.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970690/urjuzel.pdf_page-0008_jk3bno.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-11',
    lessonNumber: 211,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 11',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968018/urjuzel-11.mp3_hpobha.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970690/urjuzel.pdf_page-0008_jk3bno.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-12',
    lessonNumber: 212,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 12',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968939/urjuzel-12.mp3_f7iayu.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970691/urjuzel.pdf_page-0009_cf0ozo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970692/urjuzel.pdf_page-0010_rafjse.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-13',
    lessonNumber: 213,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 13',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968937/urjuzel-13.mp3_zp8hmr.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970691/urjuzel.pdf_page-0009_cf0ozo.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970692/urjuzel.pdf_page-0010_rafjse.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-14',
    lessonNumber: 214,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 14',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968936/urjuzel-14.mp3_ke8jmo.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970692/urjuzel.pdf_page-0010_rafjse.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970694/urjuzel.pdf_page-0011_au7g4v.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-15',
    lessonNumber: 215,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 15',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968955/urjuzel-15.mp3_bp31n8.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970696/urjuzel.pdf_page-0012_wsguul.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-16',
    lessonNumber: 216,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 16',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968997/urjuzel-16.mp3_de1eh1.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970696/urjuzel.pdf_page-0012_wsguul.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-17',
    lessonNumber: 217,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 17',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786969027/urjuzel-17.mp3_n3ekeg.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970696/urjuzel.pdf_page-0012_wsguul.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970697/urjuzel.pdf_page-0013_en9aks.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-18',
    lessonNumber: 218,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 18',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786969974/urjuzel-18.mp3_d2mkys.mp4',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970698/urjuzel.pdf_page-0014_nuzaea.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-19',
    lessonNumber: 219,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 19',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786969942/urjuzel-19.mp3_e1ego9.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970698/urjuzel.pdf_page-0014_nuzaea.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970700/urjuzel.pdf_page-0015_exsdfv.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-20',
    lessonNumber: 220,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 20',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968865/urjuzel-20.mp3_gv0sre.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970700/urjuzel.pdf_page-0015_exsdfv.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-21',
    lessonNumber: 221,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 21',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968576/urjuzel-21.mp3_v5drwo.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970701/urjuzel.pdf_page-0016_zfk1ay.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-22',
    lessonNumber: 222,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 22',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968996/urjuzel-22.mp3_wyxdin.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970701/urjuzel.pdf_page-0016_zfk1ay.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970702/urjuzel.pdf_page-0017_ru0v7l.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-23',
    lessonNumber: 223,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 23',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968501/urjuzel-23.mp3_d4dhwb.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970703/urjuzel.pdf_page-0018_ho2fsv.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-24',
    lessonNumber: 224,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 24',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968594/urjuzel-24.mp3_r0mv82.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970703/urjuzel.pdf_page-0018_ho2fsv.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970704/urjuzel.pdf_page-0019_fh96fd.jpg',
    ],
  },
  {
    id: 'urjuzetul-lesson-25',
    lessonNumber: 225,
    title: 'ኡርጁዘቱል ሚኢያህ - ደርስ 25',
    audioUrl: 'https://res.cloudinary.com/bhtqs2j6/video/upload/v1786968601/urjuzel-25.mp3_pvhatg.3gp',
    images: [
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970704/urjuzel.pdf_page-0019_fh96fd.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970706/urjuzel.pdf_page-0020_mcgpq2.jpg',
      'https://res.cloudinary.com/bhtqs2j6/image/upload/v1786970707/urjuzel.pdf_page-0021_iwxn7y.jpg',
    ],
  },
];

// ---------------------------------------------------------------------------
// 5) ኮርሶችን በ courseId ለይቶ የሚያገኝ ካርታ
// ---------------------------------------------------------------------------
const courseLessonsMap: Record<string, Lesson[]> = {
  '1': lessons,
  '2': lessonsArbaeen,
  '3': lessonsShurut,
  '4': lessonsUrjuzetul,
  'usul': lessons,
  'arbaeen': lessonsArbaeen,
  'arbain': lessonsArbaeen,
  'shurut': lessonsShurut,
  'shurut-salat': lessonsShurut,
  'urjuzetul': lessonsUrjuzetul,
  'urjizetul': lessonsUrjuzetul,
  'urjuzetul-miiyah': lessonsUrjuzetul,
};

function resolveCourseId(courseId?: string): number | null {
  const normalized = (courseId || '').toLowerCase().trim();

  const slugToCourseId: Record<string, number> = {
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    'usul': 1,
    'arbaeen': 2,
    'arbain': 2,
    'shurut': 3,
    'shurut-salat': 3,
    'urjuzetul': 4,
    'urjizetul': 4,
    'urjuzetul-miiyah': 4,
  };

  if (slugToCourseId[normalized] !== undefined) {
    return slugToCourseId[normalized];
  }

  const numeric = Number(normalized);
  return Number.isInteger(numeric) ? numeric : null;
}

// ---------------------------------------------------------------------------
// CANONICAL COURSE SLUG (for `quiz_results.course_id` column)
//
// Maps every accepted URL variant to the canonical slug stored in the
// `quiz_results` table:
//   → 'usul_al_thalatha'
//   → 'arbain'
//   → 'shurut_as_salah'
//   → 'urjuzat'
// ---------------------------------------------------------------------------
function getCanonicalCourseSlug(courseId: string): string | null {
  const normalized = (courseId || '').toLowerCase().trim();
  switch (normalized) {
    case '1':
    case 'usul':
    case 'usul_al_thalatha':
      return 'usul_al_thalatha';
    case '2':
    case 'arbaeen':
    case 'arbain':
      return 'arbain';
    case '3':
    case 'shurut':
    case 'shurut-salat':
    case 'shurut_as_salah':
      return 'shurut_as_salah';
    case '4':
    case 'urjuzetul':
    case 'urjizetul':
    case 'urjuzetul-miiyah':
    case 'urjuzat':
    case 'urjuzat_al_miiyyah':
      return 'urjuzat';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Dynamic quiz table resolver (question source tables — DO NOT ALTER)
//
//   Course 1 (Usul Al-Thalatha)   -> usul_al_thalatha_quiz
//   Course 2 (Arbain An-Nawawi)   -> arbain_quiz
//   Course 3 (Shurut As-Salah)    -> shurut_as_salah_quiz
//   Course 4 (Urjuzetul Mi'iyah)  -> questions
// ---------------------------------------------------------------------------
function getQuizTableName(courseId: number): string | null {
  switch (courseId) {
    case 1:
      return 'usul_al_thalatha_quiz';
    case 2:
      return 'arbain_quiz';
    case 3:
      return 'shurut_as_salah_quiz';
    case 4:
      return 'questions';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Column-name resolver.
//
//   The `questions` table stores the lesson identifier in `lesson_id`.
//   All other quiz tables store it in `lesson_number`.
// ---------------------------------------------------------------------------
function getLessonColumnName(tableName: string): 'lesson_id' | 'lesson_number' {
  if (tableName === 'questions') {
    return 'lesson_id';
  }
  return 'lesson_number';
}

// ---------------------------------------------------------------------------
// Strict integer parser for lesson_number / lesson_id.
// ---------------------------------------------------------------------------
function parseLessonNumber(
  lessonNumberFromList: number | undefined | null,
  currentLessonId: string | undefined | null
): number {
  if (
    lessonNumberFromList !== undefined &&
    lessonNumberFromList !== null &&
    !isNaN(Number(lessonNumberFromList))
  ) {
    const raw = Math.trunc(Number(lessonNumberFromList));
    const normalized = raw > 100 ? raw % 100 : raw;
    if (normalized >= 1) return normalized;
  }

  const digits = (currentLessonId || '').match(/\d+/g);
  if (digits && digits.length > 0) {
    const raw = parseInt(digits[digits.length - 1], 10);
    const normalized = raw > 100 ? raw % 100 : raw;
    if (normalized >= 1) return normalized;
  }

  return 1;
}

// ---------------------------------------------------------------------------
// UNIVERSAL OPTION PARSING
//
// Supports BOTH:
//
//   1) `correct_option_index` (integer 0 | 1 | 2 | 3) → PRIMARY
//      Maps directly to options[0] | options[1] | options[2] | options[3].
//
//   2) `correct_option` (legacy) → FALLBACK #1
//      May contain: Amharic label, Latin letter, numeric string, or text.
//
//   3) `correct_answer` (legacy full-text) → FALLBACK #2
//      Used by tables like `arbain_quiz` where the correct answer is stored
//      as the exact option text. Matching is trim- and case-insensitive.
//
// Options may live in either of two shapes:
//   A) Discrete columns  → option_a / option_b / option_c / option_d
//   B) JSON array column → `options` (native array or JSON string)
// ---------------------------------------------------------------------------
const AMHARIC_LABELS = ['ሀ', 'ለ', 'ሐ', 'መ'];

/** Latin letter → 0-based option index (case-insensitive). */
const LATIN_TO_INDEX: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
};

/** Return the first candidate that is non-null, non-undefined, non-empty. */
function pickFirstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text !== '') return text;
  }
  return '';
}

/** Normalize a string for safe comparison (trim + lowercase). */
function normalizeForCompare(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Return true when two answer strings match after trimming and lowercasing.
 * Empty strings never match, which prevents spurious "correct" scores.
 */
function areAnswersEqual(a: unknown, b: unknown): boolean {
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  if (left === '' || right === '') return false;
  return left === right;
}

/**
 * Safely parse an `options` column value. Accepts:
 *   • a native array               → used directly
 *   • a JSON-encoded array string  → JSON.parse'd
 *   • null / undefined / malformed → returns []
 */
function parseOptions(options: any): string[] {
  if (Array.isArray(options)) {
    return options
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v));
  }
  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (trimmed === '') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v));
      }
    } catch {
      // Not valid JSON — treat as no options available.
    }
  }
  return [];
}

/**
 * Build normalized options from discrete option_a..option_d columns.
 * Empty / null entries are skipped, but the label index is preserved
 * against the original column position (so 'option_c' always → 'ሐ').
 */
function buildOptionsFromDiscreteColumns(item: any): NormalizedOption[] {
  const rawValues = [
    item.option_a,
    item.option_b,
    item.option_c,
    item.option_d,
  ];
  const result: NormalizedOption[] = [];

  rawValues.forEach((value, index) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text === '') return;

    result.push({
      label: AMHARIC_LABELS[index] ?? String.fromCharCode(65 + index),
      text,
    });
  });

  return result;
}

/**
 * Build normalized options from an `options` array/JSON column.
 * Empty / null entries are filtered out.
 */
function buildOptionsFromArrayColumn(item: any): NormalizedOption[] {
  const arr = parseOptions(item?.options);
  const result: NormalizedOption[] = [];

  arr.forEach((value, index) => {
    const text = String(value).trim();
    if (text === '') return;

    result.push({
      label: AMHARIC_LABELS[index] ?? String.fromCharCode(65 + index),
      text,
    });
  });

  return result;
}

/**
 * Resolve a 0-based option index to its text.
 * Returns `''` when the index is out of range or the option is empty.
 */
function resolveCorrectAnswerFromIndex(
  index: number,
  options: NormalizedOption[]
): string {
  if (!Number.isFinite(index)) return '';
  if (index < 0) return '';
  if (index >= options.length) return '';
  return options[index]?.text ?? '';
}

/**
 * Resolve a raw correct-answer value to the matching option text.
 *
 * Supports (in order of precedence):
 *   1. Amharic label match ('ሀ' | 'ለ' | 'ሐ' | 'መ')
 *   2. Latin letter (A/a → 0, B/b → 1, C/c → 2, D/d → 3)
 *   3. Numeric string ('0' | '1' | '2' | '3')
 *   4. Direct text match (trim + case-insensitive)
 *   5. Raw fallback (returns the value untouched)
 */
function resolveCorrectAnswerText(
  rawCorrect: string,
  options: NormalizedOption[]
): string {
  if (rawCorrect === '') return '';

  // 1. Amharic label match.
  const byLabel = options.find((opt) => opt.label === rawCorrect);
  if (byLabel) return byLabel.text;

  // 2. Latin letter → index.
  const latinIndex = LATIN_TO_INDEX[rawCorrect.toLowerCase()];
  if (latinIndex !== undefined && options[latinIndex]) {
    return options[latinIndex].text;
  }

  // 3. Numeric string → index.
  if (/^\d+$/.test(rawCorrect)) {
    const numericIndex = parseInt(rawCorrect, 10);
    if (numericIndex >= 0 && numericIndex < options.length) {
      return options[numericIndex].text;
    }
  }

  // 4. Direct text match (trim + case-insensitive).
  const needle = normalizeForCompare(rawCorrect);
  const byText = options.find(
    (opt) => normalizeForCompare(opt.text) === needle
  );
  if (byText) return byText.text;

  // 5. Fallback: return the raw value as-is.
  return rawCorrect;
}

/**
 * Normalize one raw row coming from Supabase into a uniform shape.
 *
 * Correct-answer resolution priority:
 *   1. `correct_option_index`  → integer 0..3, maps directly by array position
 *   2. `correct_option`        → legacy, resolved via labels / letters / text
 *   3. `correct_answer`        → legacy full-text (e.g. `arbain_quiz`),
 *                                resolved via the same label / letter / text
 *                                chain. If it already *is* the option text,
 *                                it will match directly in step 4 above.
 */
function normalizeQuestion(item: any): NormalizedQuestion {
  // (1) Options — discrete columns take priority, else JSON `options`.
  const hasDiscreteColumns =
    item.option_a !== undefined ||
    item.option_b !== undefined ||
    item.option_c !== undefined ||
    item.option_d !== undefined;

  const options = hasDiscreteColumns
    ? buildOptionsFromDiscreteColumns(item)
    : buildOptionsFromArrayColumn(item);

  // (2) Correct answer resolution — priority: index → correct_option → correct_answer.
  let correctAnswerText = '';

  const hasValidIndex =
    item.correct_option_index !== null &&
    item.correct_option_index !== undefined &&
    item.correct_option_index !== '' &&
    !isNaN(Number(item.correct_option_index));

  if (hasValidIndex) {
    // Primary: `correct_option_index` (integer 0..3).
    const indexNum = Math.trunc(Number(item.correct_option_index));
    correctAnswerText = resolveCorrectAnswerFromIndex(indexNum, options);
  }

  // Fallback #1 / #2: `correct_option` then `correct_answer`.
  if (correctAnswerText === '') {
    const rawCorrect = pickFirstNonEmpty(
      item.correct_option,
      item.correct_answer
    );

    correctAnswerText = resolveCorrectAnswerText(rawCorrect, options);
  }

  return {
    id: item.id ?? item.question_id ?? Math.random().toString(36).slice(2),
    question_text: item.question_text ?? item.question ?? '',
    options,
    correctAnswerText,
    raw: item,
  };
}

export default function LessonPage() {
  const params = useParams();

  // ------------------------------------------------------------------
  // PARAM RESOLUTION (client component → useParams, synchronous)
  // ------------------------------------------------------------------
  const rawCourseId =
    (params as any)?.courseId ??
    (params as any)?.id ??
    (params as any)?.courseid ??
    (params as any)?.courseID;

  const rawLessonId =
    (params as any)?.lessonId ??
    (params as any)?.lessonid ??
    (params as any)?.lessonID ??
    (params as any)?.lesson;

  const courseId = decodeURIComponent(
    String(Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId || '')
  )
    .toLowerCase()
    .trim();

  const currentLessonId = decodeURIComponent(
    String(Array.isArray(rawLessonId) ? rawLessonId[0] : rawLessonId || '')
  )
    .toLowerCase()
    .trim();

  const courseLessons =
    courseLessonsMap[courseId] ||
    [...lessons, ...lessonsArbaeen, ...lessonsShurut, ...lessonsUrjuzetul];

  const slugNumberMatch = currentLessonId?.match(/(\d+)$/);
  const slugLessonNumber = slugNumberMatch
    ? parseInt(slugNumberMatch[1], 10)
    : null;

  const currentIndex = courseLessons.findIndex((l) => {
    const localNumber = l.lessonNumber % 100;
    if (slugLessonNumber !== null && localNumber === slugLessonNumber) {
      return true;
    }
    return l.id.toLowerCase() === currentLessonId;
  });

  const lesson = currentIndex !== -1 ? courseLessons[currentIndex] : null;

  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson');
  const [currentImg, setCurrentImg] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Strict audio finish lock (do not modify).
  const [isAudioFinished, setIsAudioFinished] = useState(false);
  const [isQuizUnlocked, setIsQuizUnlocked] = useState(false);

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // ------------------------------------------------------------------
  // Score fetched from `quiz_results` (Supabase) for the current
  // (user_id, course_id, lesson_id) triple. Displayed in the header
  // and on the quiz result screen.
  // ------------------------------------------------------------------
  const [savedScore, setSavedScore] = useState<SavedScore | null>(null);
  const [loadingSavedScore, setLoadingSavedScore] = useState(false);

  // Mark component as mounted to avoid hydration mismatch
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Reset UI on lesson change.
  useEffect(() => {
    setCurrentImg(0);
    setIsAudioFinished(false);
    setIsQuizUnlocked(false);
    setActiveTab('lesson');
    setQuizSubmitted(false);
    setScore(null);
    setSelectedAnswers({});
    setCurrentStep(0);
  }, [lesson]);

  // ------------------------------------------------------------------
  // Fetch previously saved score from `quiz_results` on lesson change.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!lesson) {
      setSavedScore(null);
      return;
    }

    let cancelled = false;

    const fetchSavedScore = async () => {
      const canonicalSlug = getCanonicalCourseSlug(courseId);
      if (!canonicalSlug) {
        if (!cancelled) setSavedScore(null);
        return;
      }

      setLoadingSavedScore(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setSavedScore(null);
          return;
        }

        const lessonNum = parseLessonNumber(
          lesson.lessonNumber,
          currentLessonId
        );

        const { data, error } = await supabase
          .from('quiz_results')
          .select('score, total_questions')
          .eq('user_id', user.id)
          .eq('course_id', canonicalSlug)
          .eq('lesson_id', lessonNum)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('Error fetching saved score:', error);
          setSavedScore(null);
          return;
        }

        if (data) {
          const total = Number(data.total_questions) || 0;
          const rawScore = Number(data.score) || 0;
          setSavedScore({
            score: rawScore,
            total,
            percentage: total > 0 ? Math.round((rawScore / total) * 100) : 0,
          });
        } else {
          setSavedScore(null);
        }
      } catch (e) {
        if (!cancelled) setSavedScore(null);
        console.error('Failed to fetch saved score:', e);
      } finally {
        if (!cancelled) setLoadingSavedScore(false);
      }
    };

    fetchSavedScore();
    return () => {
      cancelled = true;
    };
  }, [lesson, courseId, currentLessonId]);

  // ------------------------------------------------------------------
  // Fetch quiz questions from the correct dynamic table.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;

    const fetchQuiz = async () => {
      setLoadingQuiz(true);
      setQuizError(null);
      setQuizSubmitted(false);
      setScore(null);
      setSelectedAnswers({});
      setCurrentStep(0);

      try {
        const numericCourseId = resolveCourseId(courseId);

        if (numericCourseId === null) {
          console.error('Unable to resolve course id:', courseId);
          setQuizError('ኮርሱን መለየት አልተቻለም።');
          setQuiz(null);
          setQuestions([]);
          return;
        }

        const tableName = getQuizTableName(numericCourseId);
        if (!tableName) {
          setQuizError('ለዚህ ኮርስ የፈተና ጥያቄዎች አልተዘጋጁም');
          setQuiz(null);
          setQuestions([]);
          return;
        }

        const lessonColumn = getLessonColumnName(tableName);

        const targetLessonNumber = parseLessonNumber(
          lesson?.lessonNumber,
          currentLessonId
        );

        console.log(
          `Fetching quiz | table=${tableName} | column=${lessonColumn} | value=${targetLessonNumber}`
        );

        const { data: questionsData, error: questionsError } = await supabase
          .from(tableName)
          .select('*')
          .eq(lessonColumn, targetLessonNumber)
          .order('id', { ascending: true });

        if (questionsError) {
          console.error(
            `Fetch questions error from ${tableName}:`,
            JSON.stringify(questionsError, null, 2)
          );
          setQuizError('ጥያቄዎችን ማምጣት አልተቻለም።');
          setQuiz(null);
          setQuestions([]);
          return;
        }

        if (!questionsData || questionsData.length === 0) {
          setQuizError('ለዚህ ደርስ እስካሁን ምንም ጥያቄ አልተዘጋጀም');
          setQuiz(null);
          setQuestions([]);
          return;
        }

        const parsedQuestions: NormalizedQuestion[] =
          questionsData.map(normalizeQuestion);

        setQuiz(null);
        setQuestions(parsedQuestions);
        setQuizError(null);
      } catch (err: any) {
        console.error('Quiz fetch error (outer):', err);
        setQuizError('አልተጠበቀ ስህተት ተከስቷል። እባክዎ ደግመው ይሞክሩ።');
        setQuiz(null);
        setQuestions([]);
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    };

    fetchQuiz();
    return () => {
      cancelled = true;
    };
  }, [lesson, courseId, currentLessonId, retryKey]);

  // Audio ended handler.
  const handleAudioEnded = () => {
    if (isAudioFinished) return; // idempotent
    console.log('Audio completed → unlocking + auto-starting quiz...');
    setIsAudioFinished(true);
    setIsQuizUnlocked(true);
    setActiveTab('quiz');
    setRetryKey((prev) => prev + 1);
  };

  // Fallback safety net — hardened against 0:00 false positives.
  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (
      Number.isFinite(audio.duration) &&
      audio.duration > 1 &&
      audio.currentTime > 0.5 &&
      audio.currentTime >= audio.duration - 0.5
    ) {
      handleAudioEnded();
    }
  };

  const handleOptionSelect = (
    questionId: string | number,
    optionText: string
  ) => {
    if (quizSubmitted || submittingQuiz) return;
    setSelectedAnswers((prev) => ({ ...prev, [String(questionId)]: optionText }));
  };

  // ------------------------------------------------------------------
  // Submit → save score to `quiz_results` via upsert.
  // onConflict target: (user_id, course_id, lesson_id)
  //
  // Scoring compares the user's selected option *text* against the
  // normalized `correctAnswerText` using `areAnswersEqual`, which trims
  // and lowercases both sides — this prevents false 0 scores caused by
  // stray whitespace or case differences between `correct_answer` and
  // the option text stored in `arbain_quiz`.
  // ------------------------------------------------------------------
  const handleSubmitQuiz = async () => {
    if (!questions.length || !lesson || submittingQuiz) return;

    setSubmittingQuiz(true);

    const correctCount = questions.reduce((acc, q) => {
      const selected = selectedAnswers[String(q.id)];
      return areAnswersEqual(selected, q.correctAnswerText) ? acc + 1 : acc;
    }, 0);

    const total = questions.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    setScore(correctCount);
    setQuizSubmitted(true);

    // Optimistically update the header badge.
    setSavedScore({ score: correctCount, total, percentage });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.warn('No auth user; cannot persist score to quiz_results.');
        setSubmittingQuiz(false);
        return;
      }

      const canonicalSlug = getCanonicalCourseSlug(courseId);
      if (!canonicalSlug) {
        console.error(
          'Cannot resolve canonical course slug for quiz_results:',
          courseId
        );
        setSubmittingQuiz(false);
        return;
      }

      const lessonNum = parseLessonNumber(
        lesson.lessonNumber,
        currentLessonId
      );

      const { error } = await supabase.from('quiz_results').upsert(
        {
          user_id: user.id,
          course_id: canonicalSlug,
          lesson_id: lessonNum,
          score: correctCount,
          total_questions: total,
        },
        { onConflict: 'user_id,course_id,lesson_id' }
      );

      if (error) {
        console.error('quiz_results upsert error:', error);
      }
    } catch (e: any) {
      console.error('Failed to save quiz result to quiz_results:', e);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const goToQuiz = () => {
    // Strict gate: quiz tab can only be entered when the audio has finished.
    if (isAudioFinished && isQuizUnlocked) {
      setActiveTab('quiz');
    }
  };
  const goToLesson = () => setActiveTab('lesson');
  const retryFetch = () => setRetryKey((prev) => prev + 1);

  const nextImage = () =>
    lesson &&
    setCurrentImg((prev) => Math.min(prev + 1, lesson.images.length - 1));

  const prevImage = () =>
    lesson && setCurrentImg((prev) => Math.max(prev - 1, 0));

  // Strict question navigation guard.
  const currentQuestion = questions[currentStep];
  const currentQuestionId = currentQuestion ? String(currentQuestion.id) : '';
  const hasAnsweredCurrent =
    !!currentQuestionId && !!selectedAnswers[currentQuestionId];

  const nextStep = () => {
    if (!hasAnsweredCurrent) return; // hard guard
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  if (!hasMounted) {
    return null;
  }

  if (!lesson) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">ደርሱ አልተገኘም</h1>
          <p className="text-slate-400">
            ይቅርታ፣ የጠየቁት ደርስ በስርዓቱ ውስጥ አልተገኘም።
          </p>
          <Link
            href={`/courses/${courseId || 1}`}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            ወደ ኮርሱ ተመለስ
          </Link>
        </div>
      </div>
    );
  }

  const quizAvailable = questions.length > 0;
  const totalImages = lesson.images.length;

  return (
    <div className="h-screen max-h-[100dvh] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {activeTab === 'lesson' ? (
            <Link
              href={`/courses/${courseId}`}
              className="p-2 bg-slate-800 rounded-lg active:bg-slate-700 shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={goToLesson}
              className="p-2 bg-slate-800 rounded-lg active:bg-slate-700 shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-slate-300" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">
              {activeTab === 'lesson'
                ? courseId === '2' ||
                  courseId === 'arbaeen' ||
                  courseId === 'arbain'
                  ? 'አርባኢን ነወዊ'
                  : courseId === '3' ||
                    courseId === 'shurut' ||
                    courseId === 'shurut-salat'
                  ? 'ሹሩጡ ሶላት'
                  : courseId === '4' ||
                    courseId === 'urjuzetul' ||
                    courseId === 'urjizetul' ||
                    courseId === 'urjuzetul-miiyah'
                  ? 'ኡርጁዘቱል ሚኢያህ'
                  : 'ኡሱሉ ሰላሳ'
                : 'ፈተና'}
            </p>
            <h1 className="text-base font-bold text-white truncate">
              {lesson.title}
            </h1>
            {/* Show previously saved score from quiz_results */}
            {savedScore && (
              <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[11px] font-medium">
                <Trophy className="h-3 w-3" />
                ውጤት፡ {savedScore.score}/{savedScore.total}
                <span className="text-emerald-500/80">
                  ({savedScore.percentage}%)
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 bg-slate-800 rounded-lg active:bg-slate-700 shrink-0"
        >
          {menuOpen ? (
            <X className="h-5 w-5 text-slate-300" />
          ) : (
            <Menu className="h-5 w-5 text-slate-300" />
          )}
        </button>
      </header>

      {/* Hamburger dropdown */}
      {menuOpen && (
        <div className="absolute top-14 right-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 w-48">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            ወደ ዳሽቦርድ
          </Link>
          <Link
            href="/courses"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            የእኔ ኮርሶች
          </Link>
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg mx-2"
          >
            ፕሮፋይል
          </Link>
        </div>
      )}

      {/* Lesson view */}
      {activeTab === 'lesson' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
            {totalImages > 0 && lesson.images.some((url) => url.trim() !== '') ? (
              <div className="relative w-full h-full flex items-center justify-center bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                <img
                  src={lesson.images[currentImg]}
                  alt={`ገፅ ${currentImg + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                {totalImages > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      disabled={currentImg === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full disabled:opacity-30"
                    >
                      <ChevronLeft className="h-5 w-5 text-white" />
                    </button>
                    <button
                      onClick={nextImage}
                      disabled={currentImg === totalImages - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 rounded-full disabled:opacity-30"
                    >
                      <ChevronRight className="h-5 w-5 text-white" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>ምስሎች ገና አልተጫኑም</p>
              </div>
            )}
          </div>
          {totalImages > 1 &&
            lesson.images.some((url) => url.trim() !== '') && (
              <p className="text-center text-xs text-slate-500 py-1">
                ገፅ {currentImg + 1} / {totalImages}
              </p>
            )}

          <div className="flex-shrink-0 p-3 bg-slate-900 border-t border-slate-800">
            {lesson.audioUrl ? (
              <div className="mb-3">
                <audio
                  ref={audioRef}
                  controls
                  className="w-full rounded-lg"
                  src={lesson.audioUrl}
                  preload="metadata"
                  onEnded={() => {
                    setIsAudioFinished(true);
                    handleAudioEnded();
                  }}
                  onTimeUpdate={handleAudioTimeUpdate}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            ) : (
              <div className="text-center py-2 text-slate-500 mb-3">
                <Volume2 className="h-6 w-6 mx-auto opacity-50" />
                <p className="text-xs">ኦዲዮ አልተገኘም</p>
              </div>
            )}

            {loadingQuiz && (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl animate-pulse">
                ጥያቄዎች በመጫን ላይ ናቸው...
              </div>
            )}

            {!loadingQuiz && quizError && (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl">
                {quizError}
                <button
                  onClick={retryFetch}
                  className="mt-2 inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  እንደገና ሞክር
                </button>
              </div>
            )}

            {!loadingQuiz && !quizError && !quizAvailable && (
              <div className="py-3 bg-slate-800 text-center text-slate-400 text-sm rounded-xl">
                ለዚህ ትምህርት ምንም ጥያቄ አልተገኘም።
                <button
                  onClick={retryFetch}
                  className="mt-2 inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  እንደገና ሞክር
                </button>
              </div>
            )}

            {/* Start Quiz button — gated by isAudioFinished */}
            {!loadingQuiz &&
              quizAvailable &&
              (isAudioFinished || !lesson.audioUrl) && (
                <button
                  type="button"
                  onClick={goToQuiz}
                  className="w-full py-3 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
                >
                  <BookOpen className="h-5 w-5" />
                  ፈተናውን ጀምር
                </button>
              )}

            {!loadingQuiz &&
              quizAvailable &&
              lesson.audioUrl &&
              !isAudioFinished && (
                <p className="text-xs text-slate-500 text-center">
                  ፈተናውን ለመጀመር ኦዲዮውን እስከ መጨረሻው ያዳምጡ።
                </p>
              )}
          </div>
        </div>
      ) : (
        /* Quiz view */
        <div className="flex-1 flex flex-col min-h-0 p-3 overflow-auto">
          <button
            type="button"
            onClick={goToLesson}
            className="mb-3 py-2 bg-slate-800 active:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> ወደ ደርሱ ተመለስ
          </button>

          {!isQuizUnlocked ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-center px-6">
                ፈተናውን ለመውሰድ እባክዎ ኦዲዮውን እስከ መጨረሻው ያዳምጡ።
              </p>
            </div>
          ) : loadingQuiz ? (
            <div className="text-center py-8 text-slate-400">
              ጥያቄዎች በመጫን ላይ ናቸው...
            </div>
          ) : quizError ? (
            <div className="text-center py-8 text-slate-400">
              {quizError}
              <button
                onClick={retryFetch}
                className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                እንደገና ሞክር
              </button>
            </div>
          ) : !quizAvailable ? (
            <div className="text-center py-8 text-slate-400">
              ለዚህ ትምህርት ምንም ጥያቄ አልተገኘም።
              <button
                onClick={retryFetch}
                className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                እንደገና ሞክር
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white mb-1">
                {quiz?.title || 'የደርሱ ፈተና'}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                ጥያቄ {currentStep + 1} / {questions.length}
              </p>

              {!quizSubmitted ? (
                <>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex-1 min-h-0 overflow-auto">
                    <p className="text-sm font-medium text-white mb-3">
                      {currentStep + 1}. {currentQuestion?.question_text}
                    </p>
                    <div className="space-y-2">
                      {currentQuestion?.options.map(
                        (opt, optIdx: number) => {
                          const isSelected =
                            selectedAnswers[currentQuestionId] === opt.text;
                          return (
                            <button
                              key={`${currentQuestionId}-${optIdx}`}
                              type="button"
                              onClick={() =>
                                handleOptionSelect(
                                  currentQuestion.id,
                                  opt.text
                                )
                              }
                              disabled={submittingQuiz}
                              className={`w-full text-left p-3 rounded-xl border text-sm transition-colors flex items-start gap-2 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <span className="font-bold text-emerald-400 shrink-0">
                                {opt.label}.
                              </span>
                              <span className="flex-1">{opt.text}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {!hasAnsweredCurrent && !submittingQuiz && (
                    <p className="text-xs text-amber-400/80 text-center mt-2">
                      እባክዎ ለመቀጠል መጀመሪያ መልስ ይምረጡ።
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-3">
                    <button
                      type="button"
                      onClick={prevStep}
                      disabled={currentStep === 0 || submittingQuiz}
                      className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium disabled:opacity-40"
                    >
                      ወደ ኋላ
                    </button>
                    {currentStep < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        disabled={!hasAnsweredCurrent || submittingQuiz}
                        className={`flex-1 py-3 rounded-xl font-medium transition-opacity ${
                          hasAnsweredCurrent && !submittingQuiz
                            ? 'bg-emerald-600 text-white active:bg-emerald-700'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                      >
                        ቀጣይ
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        disabled={!hasAnsweredCurrent || submittingQuiz}
                        className={`flex-1 py-3 rounded-xl font-bold transition-opacity ${
                          hasAnsweredCurrent && !submittingQuiz
                            ? 'bg-emerald-600 text-white active:bg-emerald-700'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                      >
                        {submittingQuiz ? 'አስረክብ...' : 'አስረክብ'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <p className="text-emerald-400 font-bold text-lg">
                    ውጤት፡ {score}/{questions.length}
                  </p>
                  <p className="text-slate-400 text-sm">
                    ({questions.length > 0
                      ? Math.round(((score ?? 0) / questions.length) * 100)
                      : 0}
                    %)
                  </p>
                  {savedScore && (
                    <p className="text-xs text-emerald-500/80">
                      ውጤትዎ በስርዓቱ ተቀምጧል — በደርሱ ገፅ ላይ ይታያል።
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={goToLesson}
                    className="w-full py-3 bg-slate-800 active:bg-slate-700 text-white rounded-xl"
                  >
                    ወደ ደርሱ ተመለስ
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}