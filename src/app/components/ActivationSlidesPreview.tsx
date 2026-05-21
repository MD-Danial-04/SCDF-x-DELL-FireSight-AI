import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  ACTIVATION_SLIDE_TEMPLATE_ROWS,
  SLIDE1_TITLE,
} from "../constants/activationSlideTableRows";
import type { ActivationSlideData } from "../types/activationSlides";
import { formatFieldForSlide } from "../lib/slideDisplayFormat";
import type { SlidePhotoInput } from "../lib/generateActivationSlides";
import {
  observeSlidePreviewFit,
  scheduleSlidePreviewFit,
  SLIDE_DESIGN_WIDTH,
} from "../lib/fitSlidePreviewToWidth";
import { Camera } from "lucide-react";
import slideBackgroundUrl from "../../assets/slides/slide-background.png?url";

const SLIDE_DESIGN_HEIGHT = 540;

interface ActivationSlidesPreviewProps {
  data: ActivationSlideData;
  photos: SlidePhotoInput[];
  viewportRef: RefObject<HTMLDivElement | null>;
}

function SlideFrame({
  slideNumber,
  children,
}: {
  slideNumber: number;
  children: ReactNode;
}) {
  return (
    <div style={{ width: SLIDE_DESIGN_WIDTH }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-gray-500">Slide {slideNumber}</span>
        <span className="text-xs text-gray-400">16:9 · SCDF template</span>
      </div>
      <div
        className="relative rounded-lg border border-gray-300 shadow-sm overflow-hidden bg-cover bg-center"
        style={{
          width: SLIDE_DESIGN_WIDTH,
          height: SLIDE_DESIGN_HEIGHT,
          backgroundImage: `url(${slideBackgroundUrl})`,
        }}
      >
        <div className="absolute inset-0 flex flex-col overflow-hidden px-4 pt-3 pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoTableSlide({ data }: { data: ActivationSlideData }) {
  return (
    <SlideFrame slideNumber={1}>
      <h3 className="shrink-0 mb-2 text-center text-[26px] font-bold leading-tight text-black">
        {SLIDE1_TITLE}
      </h3>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <div className="w-full max-w-[845px] rounded-sm bg-white/30 backdrop-blur-[1px]">
          <table className="mx-auto w-full border-collapse bg-white/80 text-[12px]">
            <tbody>
              {ACTIVATION_SLIDE_TEMPLATE_ROWS.map((row, index) => {
                const values = row.valueKeys.map((key) => formatFieldForSlide(key, data[key]));
                return (
                  <tr key={`${row.label}-${index}`}>
                    <td className="w-[38%] border border-black px-2 py-0.5 align-middle font-semibold text-black">
                      {row.label}
                    </td>
                    <td
                      className="border border-black px-2 py-0.5 align-middle text-black"
                      colSpan={values.length === 1 ? 2 : 1}
                    >
                      {values[0]}
                    </td>
                    {values.length > 1 && (
                      <td className="w-[18%] border border-black px-2 py-0.5 align-middle text-black">
                        {values[1]}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SlideFrame>
  );
}

function PhotoRowSlide({
  data,
  photos,
}: {
  data: ActivationSlideData;
  photos: SlidePhotoInput[];
}) {
  const caseId = formatFieldForSlide("incidentNo", data.incidentNo);
  const remarks = formatFieldForSlide("otherRemarks", data.otherRemarks);

  return (
    <SlideFrame slideNumber={2}>
      <p className="shrink-0 pt-0.5 text-center text-[22px] font-bold leading-tight text-black">
        {caseId}
      </p>

      <div className="flex min-h-0 flex-1 items-center px-[31px]">
        <div className="flex w-full gap-[21px]">
          {photos.map((photo) => (
            <div key={photo.id} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex aspect-[4/3] w-full max-h-[164px] items-center justify-center overflow-hidden rounded-sm border border-gray-400 bg-white/50">
                {photo.preview ? (
                  <img
                    src={photo.preview}
                    alt={photo.label}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-1 text-gray-500">
                    <Camera className="mb-0.5 h-6 w-6" />
                    <span className="text-[11px]">Upload Photo</span>
                  </div>
                )}
              </div>
              <p className="mt-1 line-clamp-3 text-center text-[12px] font-medium leading-tight text-black">
                {photo.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto shrink-0 border-t border-black/10 pt-2 text-[12px] leading-snug text-black">
        Other remarks: {remarks}
      </p>
    </SlideFrame>
  );
}

export function ActivationSlidesPreview({
  data,
  photos,
  viewportRef,
}: ActivationSlidesPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const host = hostRef.current;
    const scaler = scalerRef.current;
    if (!viewport || !host || !scaler) return;

    const elements = { viewport, host, scaler };
    const cancelSchedule = scheduleSlidePreviewFit(elements);
    const unobserve = observeSlidePreviewFit(elements);

    return () => {
      cancelSchedule();
      unobserve();
    };
  }, [viewportRef, data, photos]);

  return (
    <div ref={scalerRef} className="mx-auto">
      <div ref={hostRef} className="flex flex-col gap-4" style={{ width: SLIDE_DESIGN_WIDTH }}>
        <InfoTableSlide data={data} />
        <PhotoRowSlide data={data} photos={photos} />
      </div>
    </div>
  );
}
