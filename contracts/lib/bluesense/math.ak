// ssADA mint: how many ssADA does ada_in lovelace buy?
// First deposit (empty vault): 1 ssADA per lovelace.
// Subsequent: ssada_out = ada_in * total_ssada / total_ada
pub fn calc_mint_amount(ada_in: Int, total_ada: Int, total_ssada: Int) -> Int {
  if total_ssada == 0 || total_ada == 0 {
    ada_in
  } else {
    ada_in * total_ssada / total_ada
  }
}

// ssADA burn: how much ADA (lovelace) does burning ssada_in tokens return?
pub fn calc_redeem_amount(ssada_in: Int, total_ada: Int, total_ssada: Int) -> Int {
  ssada_in * total_ada / total_ssada
}

pub fn price_per_share(total_ada: Int, total_ssada: Int) -> Int {
  if total_ssada == 0 {
    1
  } else {
    total_ada / total_ssada
  }
}
