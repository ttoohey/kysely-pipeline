import { Selectable } from "kysely";
import { addPetsToPerson, findPerson } from "./person.js";
import { findPet } from "./pet.js";
import { Database } from "./db.js";

type Person = Selectable<Database["person"]>;
type Pet = Selectable<Database["pet"]>;

type Pets = { pets: Pet[] };

/**
 * Use `.compose()` to extend the query builder to find
 * related `Pet` records.
 *
 * `findPet()` is a query pipeline for selecting all pets
 *
 * `addPetsToPerson(findPet())` extends the "person" pipeline to include
 * a `pets` field containing the pets identified in the `findPet()` pipeline,
 * with the query extended to find only related `pet` records.
 *
 * The findPerson() pipeline resolves to a `Person & { pets: Pet[] }` shape.
 */
async () => {
  const person = await findPerson().compose(addPetsToPerson(findPet()));
  console.log(person satisfies Person & Pets);
  for (const pet of person.pets) {
    console.log(pet satisfies Pet);
  }
};
