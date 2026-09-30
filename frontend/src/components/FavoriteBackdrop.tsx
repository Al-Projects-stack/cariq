import { useAuth } from "../contexts/AuthContext";
import { CarImage } from "./CarImage";

/**
 * Blurry favourite-car backdrop. Renders nothing until the user is signed
 * in with a favourite picked - then sits fixed behind everything with a
 * heavy blur + dark overlay so text stays readable.
 */
export function FavoriteBackdrop() {
  const { user, favoriteCar } = useAuth();
  if (!user || !favoriteCar) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <CarImage
        make={favoriteCar.make}
        model={favoriteCar.model}
        eager
        className="absolute inset-0 h-full w-full"
        imgClassName="blur-2xl scale-110"
      />
      <div className="absolute inset-0 bg-gray-950/75" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/70 via-gray-950/20 to-gray-950" />
    </div>
  );
}
